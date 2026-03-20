import { Layout } from "@/components/layout";
import { Card, StatusBadge } from "@/components/ui-elements";
import { useListApplications } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Award } from "lucide-react";

export default function Approved() {
  const { data: applications, isLoading } = useListApplications();
  
  // Filter client side since the API doesn't support 'in' operator natively yet
  const approvedStatuses = ["GS approved", "CoE Approved", "Visa Granted"];
  const filtered = applications?.filter(app => approvedStatuses.includes(app.application_status)) || [];

  return (
    <Layout>
      <div className="h-full flex flex-col space-y-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight text-emerald-900">Approved Students</h1>
            <p className="text-emerald-700/80 mt-1 font-medium">Celebrate success - applications that have reached final milestones.</p>
          </div>
        </div>

        <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border-emerald-200 shadow-emerald-900/5">
          <div className="table-container flex-1 h-full border-0 rounded-none">
            <table className="spreadsheet-table w-full h-full">
              <thead className="bg-emerald-50">
                <tr>
                  <th className="text-emerald-900 border-emerald-200">Student Name</th>
                  <th className="text-emerald-900 border-emerald-200">University & Course</th>
                  <th className="text-emerald-900 border-emerald-200">Intake</th>
                  <th className="text-emerald-900 border-emerald-200">Status</th>
                  <th className="text-emerald-900 border-emerald-200">Assignee</th>
                  <th className="text-emerald-900 border-emerald-200">Updated</th>
                </tr>
              </thead>
              <tbody className="align-top">
                {isLoading ? (
                  <tr><td colSpan={6} className="text-center py-12 text-emerald-700">Loading approved applications...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-emerald-700">No approved applications found.</td></tr>
                ) : (
                  filtered.map(app => (
                    <tr key={app.id} className="hover:bg-emerald-50/50">
                      <td className="font-semibold text-emerald-950">{app.student?.full_name}</td>
                      <td>
                        <div className="font-medium text-emerald-800">{app.university?.name || '-'}</div>
                        <div className="text-xs text-emerald-600">{app.course || '-'}</div>
                      </td>
                      <td className="text-emerald-800">{app.intake || '-'}</td>
                      <td><StatusBadge status={app.application_status} /></td>
                      <td className="text-emerald-800 font-medium">{app.assigned_to?.full_name || '-'}</td>
                      <td className="text-emerald-600 text-sm">{format(new Date(app.updated_at), 'MMM d, yyyy')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
