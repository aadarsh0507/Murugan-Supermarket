import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function DataTable({ data, columns, onRowClick }) {
  return (
    <div className="rounded-lg border bg-card w-full min-w-0 overflow-hidden">
      <div className="table-scroll">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.key.toString()}>{column.header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                No data available
              </TableCell>
            </TableRow>
          ) : (
            data.map((item, index) => (
              <TableRow
                key={index}
                onClick={() => onRowClick?.(item)}
                className={onRowClick ? "cursor-pointer hover:bg-accent/50" : ""}
              >
                {columns.map((column) => {
                  if (column.render) {
                    return (
                      <TableCell key={column.key.toString()}>
                        {column.render(item)}
                      </TableCell>
                    );
                  }

                  const value = item[column.key];
                  const isEmpty = value === null || value === undefined;
                  const displayValue = isEmpty ? "" : String(value);

                  return (
                    <TableCell key={column.key.toString()}>
                      {displayValue}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}
