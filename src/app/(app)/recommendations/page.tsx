import { MapPin, Sparkles, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  fetchActiveBranches,
  fetchAllAreas,
  fetchCustomers,
} from "@/lib/analytics/queries";
import {
  RECOMMENDATION_DEFAULT_COVERAGE_RADIUS_KM,
  RECOMMENDATION_WEIGHTS,
  generateRecommendations,
} from "@/lib/analytics/recommendations";
import { formatKm, formatNumber, formatPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Recommendations — Hyderabad Sweets",
};

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{score.toFixed(0)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-brand-maroon transition-all"
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
    </div>
  );
}

export default async function RecommendationsPage() {
  const [customers, branches, areas] = await Promise.all([
    fetchCustomers({ limit: 10000 }),
    fetchActiveBranches(),
    fetchAllAreas(),
  ]);
  const recs = generateRecommendations(customers, branches, areas, { topN: 5 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">Branch recommendations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Heuristic ranking of HMR areas based on demand, growth, travel distance, coverage gaps, and
          repeat customers. Fully explainable — see the score breakdown below each card.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-gold" /> How the score works
          </CardTitle>
          <CardDescription>
            Each candidate area is rated 0-100 on five sub-scores, then combined using the weights
            below.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          {Object.entries(RECOMMENDATION_WEIGHTS).map(([key, value]) => (
            <div key={key} className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{key}</p>
              <p className="mt-1 font-display text-xl font-semibold">
                {formatPercent(value * 100, 0)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      {recs.length === 0 ? (
        <Card>
          <CardContent className="grid place-items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <Target className="h-6 w-6 text-muted-foreground" />
            <p>
              Add more customers to surface expansion candidates. We need a minimum of demand in
              at least one HMR area outside your existing branches.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {recs.map((r, idx) => (
            <Card id={r.area} key={r.area}>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Badge variant="maroon">#{idx + 1}</Badge>
                    {r.area}
                    <span className="text-xs font-normal text-muted-foreground">· {r.zone}</span>
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {r.topSubArea ? (
                      <>Hotspot sub-area: <strong>{r.topSubArea}</strong></>
                    ) : (
                      "Recommended cluster for next expansion"
                    )}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Confidence
                  </div>
                  <div className="font-display text-3xl font-semibold text-brand-maroon dark:text-brand-goldLight">
                    {r.confidenceScore.toFixed(0)}/100
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <Metric label="Customers (30d)" value={formatNumber(r.customersLast30d)} />
                    <Metric label="Customers (total)" value={formatNumber(r.customers)} />
                    <Metric
                      label="Growth"
                      value={r.growthPct == null ? "—" : `${r.growthPct > 0 ? "+" : ""}${r.growthPct.toFixed(1)}%`}
                    />
                    <Metric
                      label="Avg travel today"
                      value={r.avgTravelKm == null ? "—" : formatKm(r.avgTravelKm)}
                    />
                    <Metric
                      label="Nearest branch"
                      value={r.nearestBranchKm == null ? "—" : formatKm(r.nearestBranchKm)}
                    />
                    <Metric
                      label="Repeat rate"
                      value={`${(r.repeatCustomerRate * 100).toFixed(0)}%`}
                    />
                    <Metric label="Estimated reach" value={`~${formatNumber(r.estimatedReach)}`} />
                    <Metric
                      label="Coverage radius"
                      value={`${RECOMMENDATION_DEFAULT_COVERAGE_RADIUS_KM} km`}
                    />
                  </div>
                  {r.estimatedDistanceReductionKm != null && (
                    <div className="rounded-md border bg-brand-gold/10 p-3 text-sm">
                      Opening here could reduce average customer travel by ~
                      <strong>{r.estimatedDistanceReductionKm.toFixed(1)} km</strong>.
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Why we picked it</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {r.reasons.map((reason, i) => (
                      <li key={i} className="flex gap-2">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-maroon dark:text-brand-gold" />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-3 rounded-md border bg-muted/30 p-4">
                  <h4 className="text-sm font-semibold">Score breakdown</h4>
                  <Separator />
                  <ScoreBar label="Demand" score={r.demandScore} />
                  <ScoreBar label="Growth" score={r.growthScore} />
                  <ScoreBar label="Distance travelled today" score={r.distanceScore} />
                  <ScoreBar label="Coverage gap" score={r.coverageScore} />
                  <ScoreBar label="Repeat customers" score={r.repeatScore} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-2">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-display text-base font-semibold">{value}</p>
    </div>
  );
}
