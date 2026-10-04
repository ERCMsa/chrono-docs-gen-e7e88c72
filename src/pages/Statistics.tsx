import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDocuments, DOCUMENT_TYPES } from "@/lib/supabase-helpers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell } from "recharts";
import { format, parseISO, startOfMonth, startOfYear, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { BarChart3, PieChart as PieChartIcon } from "lucide-react";

type Period = "daily" | "monthly" | "yearly";

const CHART_COLORS = [
  "hsl(357 79% 45%)",
  "hsl(214 72% 46%)",
  "hsl(151 55% 38%)",
  "hsl(36 92% 45%)",
];

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-popup">
      <p className="mb-1 font-semibold text-foreground">{label}</p>
      <div className="space-y-0.5">
        {payload.map((entry: any) => (
          <p key={entry.dataKey ?? entry.name} className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color || entry.payload?.fill }} />
            {entry.name}
            <span className="ml-auto pl-3 font-semibold text-foreground tabular-nums">{entry.value}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

const axisTick = { fill: "hsl(218 12% 45%)", fontSize: 12 };

export default function Statistics() {
  const [period, setPeriod] = useState<Period>("monthly");
  const { data: documents, isLoading } = useQuery({ queryKey: ["documents"], queryFn: getDocuments });

  const docs = documents ?? [];

  // Pie chart data
  const typeCounts = Object.entries(DOCUMENT_TYPES).map(([key, { label }]) => ({
    name: label,
    value: docs.filter((d) => d.document_type === key).length,
  }));
  const total = typeCounts.reduce((sum, t) => sum + t.value, 0);

  // Bar chart data grouped by period
  const groupKey = (dateStr: string) => {
    const d = parseISO(dateStr);
    if (period === "daily") return format(d, "dd/MM/yyyy");
    if (period === "monthly") return format(d, "MMM yyyy", { locale: fr });
    return format(d, "yyyy");
  };

  const grouped: Record<string, Record<string, number>> = {};
  docs.forEach((doc) => {
    const key = groupKey(doc.created_at);
    if (!grouped[key]) grouped[key] = {};
    grouped[key][doc.document_type] = (grouped[key][doc.document_type] || 0) + 1;
  });

  const barData = Object.entries(grouped)
    .map(([period, counts]) => ({ period, ...counts }))
    .sort((a, b) => a.period.localeCompare(b.period));

  const CHART_BARS = Object.entries(DOCUMENT_TYPES);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Statistiques"
        description="Analyse de la production documentaire"
      >
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Journalier</SelectItem>
            <SelectItem value="monthly">Mensuel</SelectItem>
            <SelectItem value="yearly">Annuel</SelectItem>
          </SelectContent>
        </Select>
      </PageHeader>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {typeCounts.map((t, i) => (
          <div key={t.name} className="panel p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-[13px] font-medium text-muted-foreground">{t.name}</p>
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: CHART_COLORS[i] }}
              />
            </div>
            <p className="mt-2 text-[28px] font-bold leading-none tracking-tight tabular-nums">{t.value}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {total > 0 ? `${Math.round((t.value / total) * 100)}% du total` : "Aucun document"}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Bar chart */}
        <div className="panel p-6 lg:col-span-2">
          <h2 className="mb-1 text-[15px] font-semibold tracking-tight">Documents par période</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            {period === "daily" ? "Par jour" : period === "monthly" ? "Par mois" : "Par année"}
          </p>
          {isLoading ? (
            <div className="flex h-[350px] items-center justify-center">
              <div className="h-4 w-40 animate-pulse rounded bg-muted/60" />
            </div>
          ) : barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={barData} barCategoryGap="18%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="period" tick={axisTick} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
                <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={34} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.45)" }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" iconSize={8} />
                {CHART_BARS.map(([key, { label }], i) => (
                  <Bar key={key} dataKey={key} name={label} fill={CHART_COLORS[i]} radius={[4, 4, 0, 0]} maxBarSize={42} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={BarChart3} title="Aucune donnée" description="Aucun document généré sur cette période." className="h-[350px] py-0" />
          )}
        </div>

        {/* Pie chart */}
        <div className="panel p-6">
          <h2 className="mb-1 text-[15px] font-semibold tracking-tight">Répartition par type</h2>
          <p className="mb-4 text-xs text-muted-foreground">Part de chaque type de document</p>
          {isLoading ? (
            <div className="flex h-[350px] items-center justify-center">
              <div className="h-4 w-40 animate-pulse rounded bg-muted/60" />
            </div>
          ) : docs.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie data={typeCounts} cx="50%" cy="50%" innerRadius={55} outerRadius={95} dataKey="value" paddingAngle={3} strokeWidth={0}>
                  {typeCounts.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={PieChartIcon} title="Aucune donnée" description="Aucun document généré pour le moment." className="h-[350px] py-0" />
          )}
        </div>
      </div>
    </div>
  );
}