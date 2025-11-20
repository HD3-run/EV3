import { ResponsiveContainer } from 'recharts';
import { ReportData } from '../types/report.types';
import LineChart from './LineChart';
import BarChart from './BarChart';
import PieChart from './PieChart';
import ScatterChart from './ScatterChart';
import { ChartRefs } from '../utils/chartCapture';

interface HiddenChartsProps {
  data: ReportData[];
  chartRefs: ChartRefs;
}

export default function HiddenCharts({ data, chartRefs }: HiddenChartsProps) {
  return (
    <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '800px', height: '400px' }}>
      {/* Line Chart */}
      <div ref={chartRefs.line} style={{ width: '800px', height: '400px', backgroundColor: '#1f2937' }}>
        {data.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} />
          </ResponsiveContainer>
        )}
      </div>

      {/* Bar Chart */}
      <div ref={chartRefs.bar} style={{ width: '800px', height: '400px', backgroundColor: '#1f2937' }}>
        {data.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} />
          </ResponsiveContainer>
        )}
      </div>

      {/* Pie Chart */}
      <div ref={chartRefs.pie} style={{ width: '800px', height: '400px', backgroundColor: '#1f2937' }}>
        {data.length > 0 && data.filter(item => item.revenue > 0).length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart data={data} useEqualizedData={true} />
          </ResponsiveContainer>
        )}
      </div>

      {/* Scatter Chart */}
      <div ref={chartRefs.scatter} style={{ width: '800px', height: '400px', backgroundColor: '#1f2937' }}>
        {data.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart data={data} />
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

