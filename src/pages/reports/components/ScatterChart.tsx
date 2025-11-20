import { ScatterChart as RechartsScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { ReportData } from '../types/report.types';
import { formatCurrency } from '../../../utils/currency';

interface ScatterChartProps {
  data: ReportData[];
}

export default function ScatterChart({ data }: ScatterChartProps) {
  // Ensure data has valid numeric values
  const validData = data.map(item => ({
    ...item,
    sales: Number(item.sales) || 0,
    revenue: Number(item.revenue) || 0
  }));

  return (
    <RechartsScatterChart data={validData}>
      <CartesianGrid strokeDasharray="3 3" stroke="#4a4a4a" />
      <XAxis dataKey="sales" name="Sales" stroke="#9ca3af" />
      <YAxis dataKey="revenue" name="Revenue" stroke="#9ca3af" />
      <Tooltip 
        cursor={{ strokeDasharray: '3 3' }}
        formatter={(value: number, name: string) => {
          if (name === 'Revenue') {
            return [formatCurrency(value), name];
          }
          return [value, name];
        }}
      />
      <Legend />
      <Scatter dataKey="revenue" fill="#8884d8" />
    </RechartsScatterChart>
  );
}

