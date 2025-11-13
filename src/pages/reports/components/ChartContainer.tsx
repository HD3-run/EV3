import { ResponsiveContainer, LineChart as RechartsLineChart, BarChart as RechartsBarChart, PieChart as RechartsPieChart, ScatterChart as RechartsScatterChart, Line, Bar, Pie, Cell, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { ReportData, ChartType } from '../types/report.types';
import { formatCurrency } from '../../../utils/currency';
import { CHART_COLORS } from '../constants/reportConstants';

interface ChartContainerProps {
  data: ReportData[];
  chartType: ChartType;
  loading: boolean;
}

export default function ChartContainer({ data, chartType, loading }: ChartContainerProps) {
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading reports...</div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-gray-500">No data available for the selected period</div>
      </div>
    );
  }

  if (chartType === 'pie' && data.filter(item => item.revenue > 0).length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-gray-500">No revenue data available for pie chart display</div>
      </div>
    );
  }

  // Format data for charts
  const formattedData = data.map(item => {
    let formattedDate = item.date || '';
    try {
      if (!item.date) {
        formattedDate = '';
      } else if (item.date.match(/^\d{4}$/)) {
        formattedDate = item.date;
      } else if (item.date.match(/^\d{4}-\d{2}$/)) {
        const [year, month] = item.date.split('-');
        formattedDate = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-IN', { 
          month: 'short',
          year: 'numeric'
        });
      } else {
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
    <ResponsiveContainer width="100%" height={400}>
      {chartType === 'line' ? (
        <RechartsLineChart data={formattedData}>
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
          <Line yAxisId="left" type="monotone" dataKey="sales" stroke="#8884d8" name="Sales" strokeWidth={2} />
          <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#82ca9d" name="Revenue" strokeWidth={2} />
        </RechartsLineChart>
      ) : chartType === 'bar' ? (
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
      ) : chartType === 'pie' ? (
        (() => {
          const revenueData = data.filter(item => item.revenue > 0);
          const equalizedData = revenueData.map(item => {
            const originalValue = item.revenue;
            const originalPercent = originalValue / revenueData.reduce((sum, d) => sum + d.revenue, 0);
            
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
            
            let formattedName = item.date;
            try {
              if (item.date.match(/^\d{4}$/)) {
                formattedName = item.date;
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
          });

          return (
            <RechartsPieChart>
              <Pie
                data={equalizedData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, originalPercent }: any) => `${name}: ${(originalPercent * 100).toFixed(1)}%`}
                outerRadius={120}
                innerRadius={40}
                fill="#8884d8"
                dataKey="value"
                paddingAngle={2}
              >
                {equalizedData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(_, __, props: any) => [formatCurrency(props.payload.originalValue), 'Actual Revenue']}
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
                  if (data && data.originalValue) {
                    return `${value} - ${formatCurrency(data.originalValue)}`;
                  }
                  return data && data.value ? `${value} - ${formatCurrency(data.value)}` : value;
                }}
              />
            </RechartsPieChart>
          );
        })()
      ) : chartType === 'scatter' ? (
        <RechartsScatterChart data={formattedData}>
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
      ) : (
        <RechartsLineChart data={formattedData}>
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
          <Line yAxisId="left" type="monotone" dataKey="sales" stroke="#8884d8" name="Sales" strokeWidth={2} />
          <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#82ca9d" name="Revenue" strokeWidth={2} />
        </RechartsLineChart>
      )}
    </ResponsiveContainer>
  );
}

