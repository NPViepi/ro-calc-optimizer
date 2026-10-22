//! Integração nativa com o WebView2 (Windows): serve o build local na origem do site e
//! trata `window.open`/`target=_blank`.
//!
//! O Tauri não intercepta `https` sozinho, mas o WebView2 permite: registramos um filtro
//! `WebResourceRequested` para `https://simulador.latam-tools.com.br/*` e respondemos com os
//! arquivos de `web/`. O que `site_server::respond` devolve como `None` (rotas /mcp e /api/,
//! métodos diferentes de GET) não recebe resposta e segue para a internet.

use std::ffi::c_void;
use std::path::PathBuf;

use tauri::{AppHandle, Manager, Url, WebviewWindow};
use webview2_com::Microsoft::Web::WebView2::Win32::*;
use webview2_com::{take_pwstr, NewWindowRequestedEventHandler, WebResourceRequestedEventHandler};
use windows::core::{Interface, HSTRING, PCWSTR, PWSTR};
use windows::Win32::Foundation::E_POINTER;
use windows::Win32::UI::Shell::SHCreateMemStream;

use crate::site_server::{self, SITE_HOST, SITE_URL};

/// Registra a interceptação e só então navega para o site (a janela nasce em `about:blank`,
/// para nenhuma requisição do site escapar para a internet antes do filtro existir).
pub fn install(window: &WebviewWindow, web_root: PathBuf) -> tauri::Result<()> {
    let app = window.app_handle().clone();
    window.with_webview(move |webview| {
        // O `ICoreWebView2Controller` do wry pode vir de outra versão do crate webview2-com.
        // Interfaces COM são só um ponteiro (repr(transparent)), então pegamos o ponteiro
        // bruto e o embrulhamos no tipo da nossa versão (AddRef em `cloned`).
        let result = unsafe {
            let theirs = webview.controller();
            let raw: *mut c_void = std::mem::transmute_copy(&theirs);
            let controller = ICoreWebView2Controller::from_raw_borrowed(&raw).cloned();
            drop(theirs);
            match controller {
                Some(controller) => setup(&controller, web_root, app),
                None => Err(E_POINTER.into()),
            }
        };
        if let Err(error) = result {
            eprintln!("[webview2] falha ao configurar a interceptação: {error}");
        }
    })
}

unsafe fn setup(controller: &ICoreWebView2Controller, web_root: PathBuf, app: AppHandle) -> windows::core::Result<()> {
    let core = controller.CoreWebView2()?;
    let env = core.cast::<ICoreWebView2_2>()?.Environment()?;

    // Inclui as requisições feitas por workers (o motor do otimizador roda num Web Worker)
    // quando o runtime do WebView2 suporta; senão, o filtro padrão (documento).
    let filter = HSTRING::from(format!("https://{SITE_HOST}/*"));
    match core.cast::<ICoreWebView2_22>() {
        Ok(core22) => core22.AddWebResourceRequestedFilterWithRequestSourceKinds(
            PCWSTR(filter.as_ptr()),
            COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL,
            COREWEBVIEW2_WEB_RESOURCE_REQUEST_SOURCE_KINDS_ALL,
        )?,
        Err(_) => core.AddWebResourceRequestedFilter(PCWSTR(filter.as_ptr()), COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL)?,
    }

    let mut token = Default::default();
    core.add_WebResourceRequested(
        &WebResourceRequestedEventHandler::create(Box::new(move |_, args| {
            #[allow(unused_unsafe)]
            unsafe {
                let Some(args) = args else { return Ok(()) };
                let request = args.Request()?;
                let mut uri = PWSTR::null();
                request.Uri(&mut uri)?;
                let uri = take_pwstr(uri);
                let mut method = PWSTR::null();
                request.Method(&mut method)?;
                let method = take_pwstr(method);
                let accept = header(&request, "Accept");

                let Some(page) = site_server::respond(&web_root, &method, &uri, &accept) else {
                    return Ok(()); // sem resposta: o WebView2 busca na internet
                };
                let mut headers = format!("Content-Type: {}", page.content_type);
                if page.no_store {
                    headers.push_str("\r\nCache-Control: no-store");
                }
                let stream = SHCreateMemStream(Some(&page.body));
                let reason = HSTRING::from(page.reason);
                let headers = HSTRING::from(headers);
                let response = env.CreateWebResourceResponse(
                    stream.as_ref(),
                    i32::from(page.status),
                    PCWSTR(reason.as_ptr()),
                    PCWSTR(headers.as_ptr()),
                )?;
                args.SetResponse(&response)?;
                Ok(())
            }
        })),
        &mut token,
    )?;

    // window.open / target=_blank: links do site abrem na mesma janela (uma janela nova do
    // WebView2 não teria a interceptação); links externos vão para o navegador padrão.
    let navigator = core.clone();
    let mut token = Default::default();
    core.add_NewWindowRequested(
        &NewWindowRequestedEventHandler::create(Box::new(move |_, args| {
            #[allow(unused_unsafe)]
            unsafe {
                let Some(args) = args else { return Ok(()) };
                let mut uri = PWSTR::null();
                args.Uri(&mut uri)?;
                let uri = take_pwstr(uri);
                args.SetHandled(true.into())?;
                match Url::parse(&uri) {
                    Ok(url) if site_server::is_internal(&url) => {
                        let target = HSTRING::from(uri);
                        navigator.Navigate(PCWSTR(target.as_ptr()))?;
                    }
                    Ok(url) => crate::open_external(&app, &url),
                    Err(_) => {}
                }
                Ok(())
            }
        })),
        &mut token,
    )?;

    let start = HSTRING::from(SITE_URL);
    core.Navigate(PCWSTR(start.as_ptr()))?;
    Ok(())
}

unsafe fn header(request: &ICoreWebView2WebResourceRequest, name: &str) -> String {
    let Ok(headers) = request.Headers() else { return String::new() };
    let name = HSTRING::from(name);
    let mut value = PWSTR::null();
    match headers.GetHeader(PCWSTR(name.as_ptr()), &mut value) {
        Ok(()) => take_pwstr(value),
        Err(_) => String::new(),
    }
}
