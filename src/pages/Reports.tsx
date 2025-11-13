import Layout from '../components/Layout';
import { useReportManagement } from './reports/hooks/useReportManagement';
import { handleDownloadCSV, handleDownloadExcel, handleDownloadPDF } from './reports/handlers/exportHandlers';
import ReportFilters from './reports/components/ReportFilters';
import ChartContainer from './reports/components/ChartContainer';
import HiddenCharts from './reports/components/HiddenCharts';
import SummaryCards from './reports/components/SummaryCards';

export default function Reports() {
  const {
    reportType,
    chartType,
    selectedDate,
    data,
    loading,
    chartRefs,
    setReportType,
    setChartType,
    setSelectedDate
  } = useReportManagement();

  const handleCSV = () => {
    handleDownloadCSV(data, reportType);
  };

  const handleExcel = async () => {
    await handleDownloadExcel(data, reportType, chartRefs);
  };

  const handlePDF = async () => {
    await handleDownloadPDF(data, reportType, chartRefs);
  };

  return (
    <Layout>
      <h1 className="text-3xl font-bold heading-gradient mb-6">Sales Reports</h1>

      <ReportFilters
        reportType={reportType}
        chartType={chartType}
        selectedDate={selectedDate}
        onReportTypeChange={setReportType}
        onChartTypeChange={setChartType}
        onDateChange={setSelectedDate}
        onDownloadCSV={handleCSV}
        onDownloadExcel={handleExcel}
        onDownloadPDF={handlePDF}
      />

      <div className="bg-slate-800/50 p-6 rounded-lg mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Sales and Revenue Overview - {chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart
        </h2>
        <ChartContainer data={data} chartType={chartType} loading={loading} />
      </div>

      <HiddenCharts data={data} chartRefs={chartRefs} />

      <SummaryCards data={data} loading={loading} />
    </Layout>
  );
}
