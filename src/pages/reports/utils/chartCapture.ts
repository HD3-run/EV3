// Chart image capture utilities

import html2canvas from 'html2canvas';

export interface ChartRefs {
  line?: React.RefObject<HTMLDivElement>;
  bar?: React.RefObject<HTMLDivElement>;
  pie?: React.RefObject<HTMLDivElement>;
  scatter?: React.RefObject<HTMLDivElement>;
}

/**
 * Capture all chart types as images
 */
export const captureAllCharts = async (chartRefs: ChartRefs): Promise<{ [key: string]: string }> => {
  const chartImages: { [key: string]: string } = {};
  
  const chartRefsArray = [
    { type: 'line', ref: chartRefs.line },
    { type: 'bar', ref: chartRefs.bar },
    { type: 'pie', ref: chartRefs.pie },
    { type: 'scatter', ref: chartRefs.scatter }
  ];
  
  for (const { type, ref } of chartRefsArray) {
    if (ref?.current) {
      try {
        const canvas = await html2canvas(ref.current, {
          backgroundColor: '#1f2937',
          scale: 2,
          useCORS: true,
          allowTaint: true
        });
        chartImages[type] = canvas.toDataURL('image/png');
      } catch (error) {
        console.error(`Error capturing ${type} chart:`, error);
      }
    }
  }
  
  return chartImages;
};

