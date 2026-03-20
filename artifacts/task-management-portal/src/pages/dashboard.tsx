import { useGetDashboardSummary, useGetStatusCount, useGetAssigneeCount, useGetUniversityCount } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui-elements";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { Files, Clock, CheckCircle2, XCircle, TrendingUp } from "lucide-react";

export default function Dashboard() {
  const { data: summary } = useGetDashboardSummary();
  const { data: statusCounts } = useGetStatusCount();
  const { data: assigneeCounts } = useGetAssigneeCount();
  const { data: uniCounts } = useGetUniversityCount();

  const stats = [
    { title: "Total Applications", value: summary?.total || 0, icon: Files, color: "text-blue-500", bg: "bg-blue-500/10" },
    { title: "Pending Actions", value: summary?.pending || 0, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
    { title: "Approved", value: summary?.approved || 0, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { title: "Refused", value: summary?.refused || 0, icon: XCircle, color: "text-rose-500", bg: "bg-rose-500/10" },
  ];

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">Overview</h1>
            <p className="text-muted-foreground mt-1">Real-time performance metrics and workload</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <Card key={i} className="p-6 flex items-center space-x-4 hover:shadow-md transition-shadow">
                <div className={`w-14 h-14 rounded-2xl ${stat.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-7 h-7 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <h3 className="text-3xl font-display font-bold mt-1">{stat.value}</h3>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6 flex flex-col">
            <div className="flex items-center mb-6">
              <TrendingUp className="w-5 h-5 text-primary mr-2" />
              <h3 className="font-display font-semibold text-lg">Status Distribution</h3>
            </div>
            <div className="flex-1 min-h-[300px]">
              {statusCounts && statusCounts.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusCounts}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={110}
                      paddingAngle={2}
                      dataKey="count"
                      nameKey="status"
                    >
                      {statusCounts.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color !== '#eee' ? entry.color.replace('0.', '1.') : '#94a3b8'} stroke="rgba(255,255,255,0.5)" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                      itemStyle={{ color: '#1e293b', fontWeight: 600 }}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">No data available</div>
              )}
            </div>
          </Card>

          <Card className="p-6 flex flex-col">
            <h3 className="font-display font-semibold text-lg mb-6">Agent Workload</h3>
            <div className="flex-1 min-h-[300px]">
              {assigneeCounts && assigneeCounts.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={assigneeCounts} layout="vertical" margin={{ top: 0, right: 0, left: 40, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                    <XAxis type="number" tick={{fill: '#64748b'}} axisLine={false} tickLine={false} />
                    <YAxis dataKey="assignee_name" type="category" tick={{fill: '#334155', fontWeight: 500}} axisLine={false} tickLine={false} width={100} />
                    <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="count" fill="var(--color-primary)" radius={[0, 6, 6, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">No data available</div>
              )}
            </div>
          </Card>
        </div>

        <Card className="p-6 overflow-hidden">
          <h3 className="font-display font-semibold text-lg mb-6">Top Universities</h3>
          <div className="table-container">
            <table className="spreadsheet-table">
              <thead>
                <tr>
                  <th className="w-16">Rank</th>
                  <th>University Name</th>
                  <th className="text-right">Applications</th>
                </tr>
              </thead>
              <tbody>
                {uniCounts?.map((uni, i) => (
                  <tr key={i}>
                    <td className="font-medium text-muted-foreground">#{i + 1}</td>
                    <td className="font-semibold text-foreground">{uni.university_name}</td>
                    <td className="text-right font-bold text-primary">{uni.count}</td>
                  </tr>
                ))}
                {!uniCounts?.length && (
                  <tr><td colSpan={3} className="text-center py-8 text-muted-foreground">No data available</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
