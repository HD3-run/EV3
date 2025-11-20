import { PieChart as RechartsPieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { ReportData } from '../types/report.types';
import { formatCurrency } from '../../../utils/currency';
import { CHART_COLORS } from '../constants/reportConstants';

interface PieChartProps {
  data: ReportData[];
  useEqualizedData?: boolean;
}

export default function PieChart({ data, useEqualizedData = false }: PieChartProps) {
  const revenueData = data.filter(item => item.revenue > 0);

  const pieData = useEqualizedData
    ? revenueData.map(item => {
        const originalValue = item.revenue;
        const originalPercent = originalValue / revenueData.reduce((sum, d) => sum + d.revenue, 0);
        
        // Give smaller values more visual weight
        let visualWeight;
        if (originalPercent < 0.01) {
          visualWeight = 0.15;
        } else if (originalPercent < 0.05) {
          visualWeight = 0.20;
        } else if (originalPercent < 0.10) {
          visualWeight = 0.25;
        } else {
          visualWeight = originalPercent;
        }
        
        // Format date based on format (yearly, monthly, or daily)
        let formattedName = item.date;
        try {
          if (item.date.match(/^\d{4}$/)) {
            formattedName = item.date; // Yearly
          } else if (item.date.match(/^\d{4}-\d{2}$/)) {
            const [year, month] = item.date.split('-');
            formattedName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-IN', { 
              month: 'short',
              year: 'numeric'
            });
          } else {
            formattedName = new Date(item.date).toLocaleDateString('en-IN', { 
              day: '2-digit', 
              month: 'short', 
              year: 'numeric' 
            });
          }
        } catch (e) {
          formattedName = item.date;
        }
        
        return {
          name: formattedName,
          value: visualWeight,
          originalValue: originalValue,
          sales: item.sales,
          originalPercent: originalPercent
        };
      })
    : revenueData.map(item => {
        // Format date based on format (yearly, monthly, or daily)
        let formattedName = item.date;
        try {
          if (item.date.match(/^\d{4}$/)) {
            formattedName = item.date; // Yearly
          } else if (item.date.match(/^\d{4}-\d{2}$/)) {
            const [year, month] = item.date.split('-');
            formattedName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-IN', { 
              month: 'short',
              year: 'numeric'
            });
          } else {
            formattedName = new Date(item.date).toLocaleDateString('en-IN', { 
              day: '2-digit', 
              month: 'short', 
              year: 'numeric' 
            });
          }
        } catch (e) {
          formattedName = item.date;
        }
        
        return {
          name: formattedName,
          value: item.revenue,
          sales: item.sales
        };
      });

  return (
    <RechartsPieChart>
      <Pie
        data={pieData}
        cx="50%"
        cy="50%"
        labelLine={false}
        label={useEqualizedData
          ? ({ name, originalPercent }: any) => `${name}: ${(originalPercent * 100).toFixed(1)}%`
          : ({ name, percent }: any) => percent > 0.05 ? `${name}: ${(percent * 100).toFixed(1)}%` : ''
        }
        outerRadius={120}
        innerRadius={40}
        fill="#8884d8"
        dataKey="value"
        paddingAngle={2}
      >
        {pieData.map((_, index) => (
          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
        ))}
      </Pie>
      <Tooltip 
        formatter={useEqualizedData
          ? (_, __, props: any) => [formatCurrency(props.payload.originalValue), 'Actual Revenue']
          : (value: number) => [formatCurrency(value), 'Revenue']
        }
        labelFormatter={(label, payload) => {
          if (payload && payload[0]) {
            return `${label} (${payload[0].payload.sales} sales)`;
          }
          return label;
        }}
      />
      <Legend 
        formatter={(value, entry) => {
          const data = (entry as any).payload;
          if (useEqualizedData && data && data.originalValue) {
            return `${value} - ${formatCurrency(data.originalValue)}`;
          }
          return data && data.value ? `${value} - ${formatCurrency(data.value)}` : value;
        }}
      />
    </RechartsPieChart>
  );
}

