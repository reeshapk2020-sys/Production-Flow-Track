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
      <Card className="shadow-lg border-border rounded-2xl overflow-hidden">
        <CardHeader className="bg-card border-b border-border py-5 px-6">
          <CardTitle className="text-xl font-display text-foreground flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Security & Audit Trail
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 bg-card">
          <Table>
            <TableHeader className="bg-background">
              <TableRow>
                <TableHead className="py-4">Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={5} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow> :
                data?.map((log) => (
                  <TableRow key={log.id} className="hover:bg-background text-sm">
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.createdAt), 'MMM d, yyyy HH:mm:ss')}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{log.username}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                        log.action === 'CREATE' ? 'bg-emerald-100 text-emerald-700' :
                        log.action === 'UPDATE' ? 'bg-primary/15 text-primary' :
                        log.action === 'DELETE' ? 'bg-red-100 text-red-700' :
                        'bg-muted text-foreground'
                      }`}>
                        {log.action}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{log.tableName} #{log.recordId}</TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate" title={log.details}>{log.details}</TableCell>
                  </TableRow>
                ))
              }
              {data?.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No audit logs available.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
