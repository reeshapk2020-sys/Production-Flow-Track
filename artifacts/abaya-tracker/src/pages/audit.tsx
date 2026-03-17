import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Shield } from "lucide-react";
import { useGetAuditLog } from "@workspace/api-client-react";
import { format } from "date-fns";

export default function AuditPage() {
  const { data, isLoading } = useGetAuditLog();

  return (
    <AppLayout title="System Audit Log">
      <Card className="shadow-lg border-slate-200 rounded-2xl overflow-hidden">
        <CardHeader className="bg-white border-b border-slate-100 py-5 px-6">
          <CardTitle className="text-xl font-display text-slate-800 flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Security & Audit Trail
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 bg-white">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="py-4">Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={5} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" /></TableCell></TableRow> :
                data?.map((log) => (
                  <TableRow key={log.id} className="hover:bg-slate-50 text-sm">
                    <TableCell className="text-slate-500 whitespace-nowrap">
                      {format(new Date(log.createdAt), 'MMM d, yyyy HH:mm:ss')}
                    </TableCell>
                    <TableCell className="font-medium text-slate-900">{log.username}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                        log.action === 'CREATE' ? 'bg-emerald-100 text-emerald-700' :
                        log.action === 'UPDATE' ? 'bg-blue-100 text-blue-700' :
                        log.action === 'DELETE' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {log.action}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-600 font-mono text-xs">{log.tableName} #{log.recordId}</TableCell>
                    <TableCell className="text-slate-500 max-w-xs truncate" title={log.details}>{log.details}</TableCell>
                  </TableRow>
                ))
              }
              {data?.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-slate-500">No audit logs available.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
