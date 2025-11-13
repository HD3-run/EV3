import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { ReportData } from '../types/report.types';
import { formatCurrency } from '../../../utils/currency';

interface BarChartProps {
  data: ReportData[];
}

export default function BarChart({ data }: BarChartProps) {
  const formattedData = data.map(item => {
    // Handle different date formats (daily: YYYY-MM-DD, monthly: YYYY-MM, yearly: YYYY)
    let formattedDate = item.date || '';
    try {
      if (!item.date) {
        formattedDate = '';
      } else if (item.date.match(/^\d{4}$/)) {
        // Yearly format - just the year
        formattedDate = item.date;
      } else if (item.date.match(/^\d{4}-\d{2}$/)) {
        // Monthly format - YYYY-MM
        const [year, month] = item.date.split('-');
        formattedDate = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-IN', { 
          month: 'short',
          year: 'numeric'
        });
      } else {
        // Daily format - try to parse as date
        const dateObj = new Date(item.date);
        if (!isNaN(dateObj.getTime())) {
          formattedDate = dateObj.toLocaleDateString('en-IN', { 
            day: '2-digit', 
            month: 'short' 
          });
        } else {
          formattedDate = item.date;
        }
      }
    } catch (e) {
      formattedDate = item.date || '';
    }
    
    return {
      ...item,
      sales: Number(item.sales) || 0,
      revenue: Number(item.revenue) || 0,
      formattedDate
    };
  });

  return (
    <RechartsBarChart data={formattedData}>
      <CartesianGrid strokeDasharray="3 3" stroke="#4a4a4a" />
      <XAxis dataKey="formattedDate" stroke="#9ca3af" />
      <YAxis yAxisId="left" stroke="#9ca3af" />
      <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" />
      <Tooltip 
        formatter={(value: number, name: string) => {
          if (name === 'Revenue') {
            return [formatCurrency(value), name];
          }
          return [value, name];
        }}
      />
      <Legend />
      <Bar yAxisId="left" dataKey="sales" fill="#8884d8" name="Sales" radius={[2, 2, 0, 0]} />
      <Bar yAxisId="right" dataKey="revenue" fill="#82ca9d" name="Revenue" radius={[2, 2, 0, 0]} />
    </RechartsBarChart>
  );
}

