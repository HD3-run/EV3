import { ReportData } from '../types/report.types';
import { formatCurrency } from '../../../utils/currency';

interface SummaryCardsProps {
  data: ReportData[];
  loading: boolean;
}

export default function SummaryCards({ data, loading }: SummaryCardsProps) {
  const totalSales = data.reduce((sum, item) => sum + item.sales, 0);
  const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
  const averageSales = data.length > 0 ? totalSales / data.length : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div className="bg-slate-800/50 p-6 rounded-lg">
        <h2 className="text-lg font-semibold text-slate-300 mb-4">Total Sales</h2>
        <p className="text-3xl font-bold text-white">
          {loading ? '...' : totalSales}
        </p>
      </div>
      <div className="bg-slate-800/50 p-6 rounded-lg">
        <h2 className="text-lg font-semibold text-slate-300 mb-4">Total Revenue</h2>
        <p className="text-3xl font-bold text-white">
          {loading ? '...' : formatCurrency(totalRevenue)}
        </p>
      </div>
      <div className="bg-slate-800/50 p-6 rounded-lg">
        <h2 className="text-lg font-semibold text-slate-300 mb-4">Average Sales per Period</h2>
        <p className="text-3xl font-bold text-white">
          {loading ? '...' : averageSales.toFixed(2)}
        </p>
      </div>
    </div>
  );
}

