import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface GaugeCardProps {
  title: string;
  value: number;
  max?: number;
  unit?: string;
  icon?: React.ReactNode;
}

function getColor(percent: number): string {
  if (percent < 60) return "text-green-500";
  if (percent < 80) return "text-yellow-500";
  return "text-red-500";
}

function getStrokeColor(percent: number): string {
  if (percent < 60) return "stroke-green-500";
  if (percent < 80) return "stroke-yellow-500";
  return "stroke-red-500";
}

export function GaugeCard({
  title,
  value,
  max = 100,
  unit = "%",
  icon,
}: GaugeCardProps) {
  const percent = Math.min((value / max) * 100, 100);
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <div className="relative h-24 w-24">
          <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              strokeWidth="8"
              className="stroke-muted"
            />
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              className={getStrokeColor(percent)}
              style={{
                strokeDasharray: circumference,
                strokeDashoffset,
                transition: "stroke-dashoffset 0.5s ease",
              }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-lg font-bold ${getColor(percent)}`}>
              {Math.round(value)}
              {unit}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
