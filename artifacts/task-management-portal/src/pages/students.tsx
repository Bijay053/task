import { useState } from "react";
import { useListStudentsSummary } from "@workspace/api-client-react";
import type { StudentSummary } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, Input } from "@/components/ui-elements";
import { Search, UserCircle, Building2, UserCheck } from "lucide-react";

export default function Students() {
  const [search, setSearch] = useState("");
  const { data: students, isLoading } = useListStudentsSummary(
    search ? { search } : undefined
  );

  return (
    <Layout>
      <div className="h-full flex flex-col space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">Students Directory</h1>
            <p className="text-muted-foreground mt-1">Overview of all students and their linked applications.</p>
          </div>
        </div>

        <Card className="p-4 bg-muted/30 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input
              placeholder="Search by student name..."
              className="pl-10 bg-card"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </Card>

        <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="table-container flex-1 h-full border-0 rounded-none">
            <table className="spreadsheet-table w-full">
              <thead>
                <tr>
                  <th className="w-10">#</th>
                  <th>Full Name</th>
                  <th>Application IDs</th>
                  <th>Agent Name(s)</th>
                  <th>University Name(s)</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">Loading...</td></tr>
                ) : students?.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">No students found.</td></tr>
                ) : students?.map((s: StudentSummary) => (
                  <tr key={s.id}>
                    <td className="text-muted-foreground text-xs text-center">{s.id}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <UserCircle className="w-5 h-5" />
                        </div>
                        <span className="font-semibold text-foreground">{s.full_name}</span>
                      </div>
                    </td>
                    <td>
                      {s.app_ids.length === 0 ? (
                        <span className="text-muted-foreground/40 text-xs">No apps</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {s.app_ids.map(id => (
                            <span key={id} className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-mono font-semibold">
                              #{id}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      {s.agents.length === 0 ? (
                        <span className="text-muted-foreground/40 text-xs">—</span>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          {s.agents.map((agent, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-xs text-sky-600">
                              <UserCheck className="w-3 h-3 shrink-0" />
                              <span>{agent}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      {s.universities.length === 0 ? (
                        <span className="text-muted-foreground/40 text-xs">—</span>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          {s.universities.map((uni, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Building2 className="w-3 h-3 shrink-0 text-primary/60" />
                              <span>{uni}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
