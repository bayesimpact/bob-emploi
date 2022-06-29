import React from 'react'

interface Props {
  children: string
  dates: Record<string, string>
}
const DatedList = ({dates, children}: Props) => <table>
  <thead><th>{children}</th><th>Date</th></thead>
  <tbody>
    {Object.entries(dates).map(([name, date]) => <tr key={name}>
      <td>{name}</td>
      <td>{date}</td>
    </tr>)}
  </tbody>
</table>

export default React.memo(DatedList)
