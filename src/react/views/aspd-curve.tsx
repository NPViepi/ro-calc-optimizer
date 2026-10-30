import { Fragment, createElement, useMemo } from 'react';
import { AspdCurveView } from '../../app/layout/pages/ro-calculator/aspd-curve/aspd-curve.view';
import { useText } from '../state/use-text';
import './aspd-curve.css';

export function AspdCurve({ aspd, aspd2 }: { aspd: number; aspd2?: number | null }) {
  const t = useText();
  const view = useMemo(() => new AspdCurveView(aspd, aspd2, t), [aspd, aspd2, t]);
  return createElement('app-aspd-curve', null, <div className="aspd_curve">
    <svg viewBox={view.viewBox} className="aspd_curve_svg" role="img" aria-label={view.summaryText}>
      {view.yTicks.map(tick => <line key={tick.label} className="curve_grid" x1={view.plotLeft} x2={view.plotRight} y1={tick.y} y2={tick.y} />)}
      <line className="curve_axis" x1={view.plotLeft} x2={view.plotRight} y1={view.plotBottom} y2={view.plotBottom} />
      <line className="curve_axis" x1={view.plotLeft} x2={view.plotLeft} y1={view.plotTop} y2={view.plotBottom} />
      <g className="curve_tick_label">
        {view.yTicks.map(tick => <text key={`y${tick.label}`} x={tick.x - 8} y={tick.y + 4} textAnchor="end">{tick.label}</text>)}
        {view.xTicks.map(tick => <text key={`x${tick.label}`} x={tick.x} y={tick.y + 16} textAnchor="middle">{tick.label}</text>)}
      </g>
      <path className="curve_line" d={view.curvePath} />
      {view.markers.map(marker => <Fragment key={marker.isCompare ? 'compare' : 'main'}>
        <line className={`curve_drop ${marker.isCompare ? 'is_compare' : ''}`} x1={marker.x} x2={marker.x} y1={marker.y} y2={view.plotBottom} />
        {!marker.isCompare && <circle className="curve_dot_halo" cx={marker.x} cy={marker.y} r={9} />}
        <circle className={`curve_dot ${marker.isCompare ? 'is_compare' : ''}`} cx={marker.x} cy={marker.y} r={5} />
        <text className={`curve_dot_label ${marker.isCompare ? 'is_compare' : ''}`} x={marker.labelX} y={marker.labelY} textAnchor={marker.labelAnchor}>{marker.label}</text>
      </Fragment>)}
      <text className="curve_axis_title" x={(view.plotLeft + view.plotRight) / 2} y={view.plotBottom + 32} textAnchor="middle">{t('combat.aspd')}</text>
    </svg>
    <div className="curve_legend">
      <span className="curve_legend_item"><i className="swatch swatch_line" />{t('aspd.legendFormula')}</span>
      <span className="curve_legend_item"><i className="swatch swatch_dot" />{t('aspd.legendYours')}</span>
      {view.markers.length > 1 && <span className="curve_legend_item"><i className="swatch swatch_dot is_compare" />{t('aspd.legendCompare')}</span>}
    </div>
    <div className="curve_caption"><div className="curve_caption_main">{view.summaryText}</div><div className="curve_caption_next">{view.gainText}</div></div>
    <table className="curve_table"><caption>{t('aspd.tableCaption')}</caption>
      <thead><tr><th scope="col">{t('combat.hitsPerSecond')}</th><th scope="col">{t('combat.aspd')}</th></tr></thead>
      <tbody>{view.rows.map(row => <tr key={row.aspd} className={row.reached ? 'row_done' : ''}><td>{row.hits}</td><td>{row.aspd}{row.aspd === view.cap ? ' ' + t('aspd.cap') : ''}</td></tr>)}</tbody>
    </table>
    <div className="curve_note">{t('aspd.note', { cap: view.cap })}</div>
  </div>);
}
