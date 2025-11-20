import { ReportType, ChartType } from '../types/report.types';
import { REPORT_TYPES, CHART_TYPES } from '../constants/reportConstants';
import DownloadDropdown from '../../../components/DownloadDropdown';

interface ReportFiltersProps {
  reportType: ReportType;
  chartType: ChartType;
  selectedDate: string;
  onReportTypeChange: (type: ReportType) => void;
  onChartTypeChange: (type: ChartType) => void;
  onDateChange: (date: string) => void;
  onDownloadCSV: () => void;
  onDownloadExcel: () => void;
  onDownloadPDF: () => void;
}

export default function ReportFilters({
  reportType,
  chartType,
  selectedDate,
  onReportTypeChange,
  onChartTypeChange,
  onDateChange,
  onDownloadCSV,
  onDownloadExcel,
  onDownloadPDF
}: ReportFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center mb-6 space-y-4 sm:space-y-0">
      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
        <select
          value={reportType}
          onChange={(e) => onReportTypeChange(e.target.value as ReportType)}
          className="p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          {REPORT_TYPES.map(type => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
        <select
          value={chartType}
          onChange={(e) => onChartTypeChange(e.target.value as ChartType)}
          className="p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          {CHART_TYPES.map(type => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
        <DownloadDropdown
          onDownloadCSV={onDownloadCSV}
          onDownloadExcel={onDownloadExcel}
          onDownloadPDF={onDownloadPDF}
        />
      </div>

      {(reportType === 'daily' || reportType === 'monthly') && (
        <div className="flex justify-end w-full sm:w-2/3">
          <input
            type={reportType === 'daily' ? 'date' : 'month'}
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            placeholder={`Select ${reportType === 'daily' ? 'date' : 'month'}`}
            className="p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
      )}
    </div>
  );
}

