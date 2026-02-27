// components/ui/table.tsx

type Column<T> = {
  header: string;
  accessor: keyof T;
};

type TableProps<T> = {
  columns: Column<T>[];
  data: T[];
};

export default function Table<T extends Record<string, React.ReactNode>>({
  columns,
  data,
}: TableProps<T>) {
  return (
    <div className="w-full overflow-x-auto my-4">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={String(col.accessor)}
                className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-neutral-400"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={i}
              className="border-t border-white/10 last:border-b-0"
            >
              {columns.map((col) => (
                <td
                  key={String(col.accessor)}
                  className="px-4 py-2 text-neutral-200"
                >
                  {row[col.accessor]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
// Usage
//  <Table
//   columns={[
//     { header: "Stack", accessor: "stack" },
//     { header: "Library", accessor: "library" },
//   ]}
//   data={[
//     { stack: "React", library: "react-markdown" },
//     { stack: "Vue", library: "vue-markdown-render" },
//   ]}
// />