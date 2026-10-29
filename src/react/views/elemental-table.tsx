import { createElement } from 'react';
import { Table } from '../ui/table';
import { useText } from '../state/use-text';

const ELEMENTS = [['Neutral', 'Neutro'], ['Water', 'Água'], ['Earth', 'Terra'], ['Fire', 'Fogo'],
  ['Wind', 'Vento'], ['Poison', 'Veneno'], ['Holy', 'Sagrado'], ['Dark', 'Sombrio'], ['Ghost', 'Fantasma'], ['Undead', 'Maldito']] as const;
export interface ElementalRow {
  pureElementName: string; info: string;
  [key: string]: string | number;
}
export function ElementalTable({ calcMonsters, isLoading = false }: { calcMonsters: readonly ElementalRow[]; isLoading?: boolean }) {
  const t = useText();
  return createElement('app-elemental-table-raw', null, <div className="ui-fluid">
    <Table value={calcMonsters} loading={isLoading} className="ui-datatable-striped ui-datatable-sm" tableStyle={{ minWidth: 550 }}
      header={<><tr><th rowSpan={2} className="text-center font-semibold">{t('elemTable.monster')}</th><th colSpan={10} className="text-center font-semibold">{t('elemTable.attacker')}</th></tr>
        <tr>{ELEMENTS.map(([element, label]) => <th key={element} className={`property_${element} text-center px-1`}>{label}</th>)}</tr></>}
      renderRow={(item, index) => <tr key={index}><td className={`property_${item.pureElementName}`}>{item.info}</td>
        {ELEMENTS.map(([element]) => <td key={element} className={`text-center font-semibold text-lg ${item[`${element}Style`]}`}>{item[element]}</td>)}</tr>} />
  </div>);
}
