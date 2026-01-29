/**
 * Export Dialog
 * PDF export and print functionality
 */

import { useState } from 'react';
import { Download, Printer, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useLayoutStore } from '../../stores/layoutStore';
import { toast } from 'sonner';

export function ExportDialog({ open, onOpenChange, canvasRef }) {
  const { layout, objects } = useLayoutStore();
  const [isExporting, setIsExporting] = useState(false);

  const [options, setOptions] = useState({
    pageSize: 'letter',
    orientation: 'landscape',
    includeHeader: true,
    includeLegend: true,
    includeCapacity: true,
    grayscale: false,
  });

  const totalCapacity = objects.reduce((sum, obj) => sum + (obj.capacity || 0), 0);

  const handleExport = async () => {
    setIsExporting(true);

    try {
      // Get SVG element
      const svg = canvasRef?.current;
      if (!svg) {
        toast.error('Canvas not ready');
        return;
      }

      // Create a new SVG with white background
      const svgClone = svg.cloneNode(true);
      const svgData = new XMLSerializer().serializeToString(svgClone);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);

      // Create image from SVG
      const img = new Image();
      img.onload = () => {
        // Create canvas
        const canvas = document.createElement('canvas');
        const scale = 2; // Higher resolution
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        if (options.grayscale) {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          for (let i = 0; i < data.length; i += 4) {
            const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
          }
          ctx.putImageData(imageData, 0, 0);
        }

        // Generate PDF using canvas data
        const dataUrl = canvas.toDataURL('image/png');

        // Create print window with the image
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>${layout?.name || 'Layout'} - Floor Plan</title>
            <style>
              @page {
                size: ${options.pageSize} ${options.orientation};
                margin: 0.5in;
              }
              body {
                margin: 0;
                padding: 20px;
                font-family: system-ui, -apple-system, sans-serif;
              }
              .header {
                text-align: center;
                margin-bottom: 20px;
              }
              .header h1 {
                margin: 0;
                font-size: 24px;
              }
              .header p {
                margin: 5px 0 0;
                color: #666;
              }
              .floor-plan {
                text-align: center;
                margin: 20px 0;
              }
              .floor-plan img {
                max-width: 100%;
                height: auto;
                border: 1px solid #ddd;
              }
              .legend {
                margin-top: 20px;
              }
              .legend h3 {
                font-size: 14px;
                margin-bottom: 10px;
              }
              .legend-items {
                display: flex;
                flex-wrap: wrap;
                gap: 15px;
              }
              .legend-item {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 12px;
              }
              .legend-color {
                width: 16px;
                height: 16px;
                border-radius: 2px;
              }
              .capacity {
                margin-top: 20px;
              }
              .capacity h3 {
                font-size: 14px;
                margin-bottom: 10px;
              }
              .capacity-table {
                font-size: 12px;
                border-collapse: collapse;
              }
              .capacity-table td {
                padding: 4px 12px;
                border-bottom: 1px solid #eee;
              }
              .capacity-table .total {
                font-weight: bold;
                border-top: 2px solid #333;
              }
              .footer {
                margin-top: 30px;
                text-align: center;
                font-size: 10px;
                color: #999;
              }
              @media print {
                body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
              }
            </style>
          </head>
          <body>
            ${options.includeHeader ? `
              <div class="header">
                <h1>${layout?.name || 'Floor Plan'}</h1>
                <p>Generated on ${new Date().toLocaleDateString()}</p>
              </div>
            ` : ''}

            <div class="floor-plan">
              <img src="${dataUrl}" alt="Floor Plan" />
            </div>

            ${options.includeLegend ? `
              <div class="legend">
                <h3>Legend</h3>
                <div class="legend-items">
                  ${objects
                    .filter((o) => o.capacity)
                    .map((o) => `
                      <div class="legend-item">
                        <div class="legend-color" style="background-color: ${o.color || '#3B82F6'}"></div>
                        <span>${o.name || o.object_type} - ${o.capacity} capacity</span>
                      </div>
                    `)
                    .join('')}
                </div>
              </div>
            ` : ''}

            ${options.includeCapacity ? `
              <div class="capacity">
                <h3>Capacity Summary</h3>
                <table class="capacity-table">
                  ${objects
                    .filter((o) => o.capacity)
                    .map((o) => `
                      <tr>
                        <td>${o.name || o.object_type}</td>
                        <td>${o.capacity}</td>
                      </tr>
                    `)
                    .join('')}
                  <tr class="total">
                    <td>Total Capacity</td>
                    <td>${totalCapacity}</td>
                  </tr>
                </table>
              </div>
            ` : ''}

            <div class="footer">
              Generated by TicketRack Layout Design
            </div>

            <script>
              window.onload = function() {
                window.print();
              };
            </script>
          </body>
          </html>
        `);
        printWindow.document.close();

        URL.revokeObjectURL(svgUrl);
        toast.success('PDF generated! Print dialog should open.');
        onOpenChange(false);
      };

      img.src = svgUrl;
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Export Floor Plan
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Page Size */}
          <div>
            <Label className="text-sm font-medium">Page Size</Label>
            <RadioGroup
              value={options.pageSize}
              onValueChange={(value) =>
                setOptions((prev) => ({ ...prev, pageSize: value }))
              }
              className="flex gap-4 mt-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="letter" id="letter" />
                <Label htmlFor="letter" className="font-normal">
                  Letter
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="a4" id="a4" />
                <Label htmlFor="a4" className="font-normal">
                  A4
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="a3" id="a3" />
                <Label htmlFor="a3" className="font-normal">
                  A3
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Orientation */}
          <div>
            <Label className="text-sm font-medium">Orientation</Label>
            <RadioGroup
              value={options.orientation}
              onValueChange={(value) =>
                setOptions((prev) => ({ ...prev, orientation: value }))
              }
              className="flex gap-4 mt-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="landscape" id="landscape" />
                <Label htmlFor="landscape" className="font-normal">
                  Landscape
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="portrait" id="portrait" />
                <Label htmlFor="portrait" className="font-normal">
                  Portrait
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Include Options */}
          <div>
            <Label className="text-sm font-medium">Include</Label>
            <div className="space-y-2 mt-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="includeHeader"
                  checked={options.includeHeader}
                  onCheckedChange={(checked) =>
                    setOptions((prev) => ({ ...prev, includeHeader: checked }))
                  }
                />
                <Label htmlFor="includeHeader" className="font-normal">
                  Layout name and date
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="includeLegend"
                  checked={options.includeLegend}
                  onCheckedChange={(checked) =>
                    setOptions((prev) => ({ ...prev, includeLegend: checked }))
                  }
                />
                <Label htmlFor="includeLegend" className="font-normal">
                  Color legend
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="includeCapacity"
                  checked={options.includeCapacity}
                  onCheckedChange={(checked) =>
                    setOptions((prev) => ({ ...prev, includeCapacity: checked }))
                  }
                />
                <Label htmlFor="includeCapacity" className="font-normal">
                  Capacity summary
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="grayscale"
                  checked={options.grayscale}
                  onCheckedChange={(checked) =>
                    setOptions((prev) => ({ ...prev, grayscale: checked }))
                  }
                />
                <Label htmlFor="grayscale" className="font-normal">
                  Grayscale (printer-friendly)
                </Label>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4 mr-2" />
                  Export & Print
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
