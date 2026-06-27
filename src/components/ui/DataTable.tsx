import type { ReactNode, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'

export function DataTable({
  children,
  className = '',
  ...props
}: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className={`w-full text-left text-sm ${className}`} {...props}>
        {children}
      </table>
    </div>
  )
}

export function DataTableHead({ children }: { children: ReactNode }) {
  return <thead className="bg-stone-50 text-slate-600">{children}</thead>
}

export function DataTableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-slate-100 bg-white">{children}</tbody>
}

export function DataTableHeader({
  children,
  className = '',
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={`px-4 py-3 font-medium ${className}`} {...props}>
      {children}
    </th>
  )
}

export function DataTableCell({
  children,
  className = '',
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`px-4 py-3 text-slate-600 ${className}`} {...props}>
      {children}
    </td>
  )
}

export function dataTableRowClassName(clickable = false) {
  return clickable ? 'cursor-pointer hover:bg-emerald-50/60' : ''
}
