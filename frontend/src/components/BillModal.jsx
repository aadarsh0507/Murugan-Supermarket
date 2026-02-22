import React, { useMemo } from 'react';
import { X, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const BillModal = ({ isOpen, onClose, billData, isAdmin = false }) => {
  const { selectedStore } = useAuth();
  
  if (!isOpen) return null;

  const printData = useMemo(() => {
    const fallbackDate = new Date();
    const rawDate = billData?.date ? new Date(billData.date) : fallbackDate;
    const validDate = Number.isNaN(rawDate.getTime()) ? fallbackDate : rawDate;
    const formattedDate = validDate.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const formattedTime = validDate.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const toNumber = (value) => {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const normalizedItems = Array.isArray(billData?.items)
      ? billData.items.map((item) => {
          const quantity = Number.parseFloat(item.quantity ?? item.qty ?? 1);
          // Rate should be the selling price used in Items screen.
          // Accept common server/client field names.
          const sellingPrice =
            toNumber(
              item.sellingPrice ??
                item.unitPrice ??
                item.price
            ) ?? 0;
          // MRP should be the item's MRP as in Items screen (with safe fallbacks if API omits it).
          // Check multiple possible field names for MRP
          const mrp =
            toNumber(
              item.mrp ??
                item.MRP ??
                item.maxRetailPrice ??
                item.max_retail_price ??
                0
            ) ?? 0;
          const discount = Number.isFinite(Number.parseFloat(item.discount))
            ? Number.parseFloat(item.discount)
            : 0;
          const total = Number.isFinite(Number.parseFloat(item.total))
            ? Number.parseFloat(item.total)
            : Number((quantity * sellingPrice - discount).toFixed(2));

          return {
            name: item.itemName ?? item.name ?? 'Item',
            mrp: mrp > 0 ? mrp : 0, // Ensure MRP is always a valid number
            // saleRate is used as "Rate" in print; set to selling price
            saleRate: sellingPrice,
            price: sellingPrice,
            originalPrice: toNumber(item.originalPrice ?? item.Price ?? item.price),
            qty: quantity,
            netAmount: total
          };
        })
      : [];

    const printableItems = normalizedItems.length > 0 ? normalizedItems : billData?.items ?? [];

    const subtotal =
      typeof billData?.subtotal === 'number'
        ? billData.subtotal
        : normalizedItems.reduce((sum, item) => sum + item.saleRate * item.qty, 0);
    const discountValue =
      typeof billData?.discount === 'number'
        ? billData.discount
        : printableItems.reduce((sum, item) => {
            const mrpValue = Number.parseFloat(
              item.mrp ??
                item.MRP ??
                item.maxRetailPrice ??
                item.price ??
                item.saleRate ??
                item.unitPrice ??
                0
            );
            const rateValue = Number.parseFloat(
              item.saleRate ?? item.rate ?? item.unitPrice ?? item.price ?? item.netAmount ?? 0
            );
            const qtyValue = Number.parseFloat(item.qty ?? item.quantity ?? item.Qty ?? 1);

            const mrpNumber = Number.isFinite(mrpValue) ? mrpValue : 0;
            const rateNumber = Number.isFinite(rateValue) ? rateValue : 0;
            const qtyNumber = Number.isFinite(qtyValue) ? qtyValue : 1;

            return sum + Math.max(mrpNumber - rateNumber, 0) * qtyNumber;
          }, 0);
    const taxValue = typeof billData?.tax === 'number' ? billData.tax : 0;
    const totalAmount =
      typeof billData?.total === 'number'
        ? billData.total
        : Math.max(subtotal - discountValue + taxValue, 0);
    const totalQty = normalizedItems.reduce((sum, item) => sum + item.qty, 0);
    const getRateValue = (item) => {
      // Prefer saleRate (selling price), then price as fallback
      const candidates = [
        item.saleRate,
        item.price
      ];
      for (const value of candidates) {
        const parsed = Number.parseFloat(value);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
      return 0;
    };

    const computedSavings =
      printableItems.reduce((sum, item) => {
        const mrpValue = Number.parseFloat(
          item.mrp ??
            item.MRP ??
            item.maxRetailPrice ??
            item.price ??
            item.saleRate ??
            item.unitPrice ??
            0
        );
        const rateValue = getRateValue(item);
        const qtyValue = Number.parseFloat(item.qty ?? item.quantity ?? item.Qty ?? 1);

        const mrpNumber = Number.isFinite(mrpValue) ? mrpValue : 0;
        const rateNumber = Number.isFinite(rateValue) ? rateValue : 0;
        const qtyNumber = Number.isFinite(qtyValue) ? qtyValue : 1;

        return sum + Math.max(mrpNumber - rateNumber, 0) * qtyNumber;
      }, 0) || 0;
    const totalSavings =
      Number.isFinite(Number(billData?.totalSavings))
        ? Number(billData.totalSavings)
        : computedSavings;

    const billBy =
      billData?.userName ??
      billData?.billBy ??
      billData?.cashierName ??
      (billData?.userEmail ? billData.userEmail : '');

    return {
      storeName: selectedStore?.name ?? billData?.storeName ?? 'Murugan Super Market',
      address:
        billData?.address ??
        (selectedStore?.address
          ? [
              selectedStore.address.street,
              selectedStore.address.city,
              selectedStore.address.zipCode
            ]
              .filter(Boolean)
              .join(', ')
          : ''),
      phone: billData?.phone ?? (selectedStore?.phone ? `Ph: ${selectedStore.phone}` : ''),
      gstNumber: billData?.gstNumber ?? selectedStore?.gstNumber ?? '',
      date: formattedDate,
      time: formattedTime,
      billNumber: billData?.billNo ?? billData?.billNumber ?? '',
      customerName: billData?.customerName ?? '',
      customerAddress: billData?.customerAddress ?? billData?.addressLine ?? '',
      customerGstin: billData?.customerGstin ?? billData?.gstin ?? billData?.gstNumber ?? '',
      billBy: billBy,
      subtotal,
      discountAmount: discountValue,
      tax: taxValue,
      totalAmount,
      totalQty,
      totalSavings,
      items: printableItems,
      gstBreakdown:
        Array.isArray(billData?.gstBreakdown) && billData.gstBreakdown.length > 0
          ? billData.gstBreakdown
          : [],
      notes: billData?.notes ?? ''
    };
  }, [billData, selectedStore]);

  const displayStoreName =
    selectedStore?.name || billData?.storeName || printData.storeName || 'Murugan Super Market';

  const BILL_WIDTH = 48; // Increased width for better readability
  const DIVIDER_MARKER = '__DIVIDER__';

  const escapeHtml = (value = '') => {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const centerText = (text = '') => {
    const trimmed = text.toString().trim();
    if (!trimmed) return ' '.repeat(BILL_WIDTH);
    const available = Math.max(BILL_WIDTH - trimmed.length, 0);
    const left = Math.floor(available / 2);
    const right = available - left;
    return `${' '.repeat(left)}${trimmed}${' '.repeat(right)}`;
  };

  const padRight = (text = '', width = 0) => {
    const str = text.toString();
    if (str.length >= width) return str.slice(0, width);
    return `${str}${' '.repeat(width - str.length)}`;
  };

  const padLeft = (text = '', width = 0) => {
    const str = text.toString();
    if (str.length >= width) return str.slice(str.length - width);
    return `${' '.repeat(width - str.length)}${str}`;
  };

  const currency = (value = 0) => {
    const num = Number(value);
    return Number.isFinite(num) ? num.toFixed(2) : '0.00';
  };

  const qtyFormat = (value = 0) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return '0';
    return Number.isInteger(num) ? num.toString() : num.toFixed(2);
  };

    const { formattedText, formattedHtml } = useMemo(() => {
    const lines = [];
    const pushLine = (value = '') => lines.push(value);
    const divider = () => pushLine(DIVIDER_MARKER);

    pushLine(''); // Empty line for spacing
    pushLine(centerText(printData.storeName || displayStoreName));
    if (printData.gstNumber && String(printData.gstNumber).trim()) {
      pushLine(centerText(`GST IN: ${printData.gstNumber}`));
    }
    if (printData.address) pushLine(centerText(printData.address));
    if (printData.phone) pushLine(centerText(printData.phone));
    divider();
    // Calculate proper alignment for Date/Time and Bill No/User lines
    // Format: "Date : [date]    Time : [time]"
    const dateLabel = 'Date : ';
    const dateValue = String(printData.date || '').substring(0, 12); // Limit date length
    const timeLabel = ' Time : ';
    const timeValue = String(printData.time || '').substring(0, 8); // Limit time length (includes " pm" or " am")
    const dateTimeContent = dateLabel + dateValue + timeLabel + timeValue;
    const dateTimePadding = Math.max(0, BILL_WIDTH - dateTimeContent.length);
    const dateTimeLine = dateLabel + dateValue + ' '.repeat(dateTimePadding) + timeLabel + timeValue;
    // Ensure line doesn't exceed BILL_WIDTH
    pushLine(dateTimeLine.substring(0, BILL_WIDTH));
    
    // Format: "Bill No: [number]    User : [user]"
    const billLabel = 'Bill No: ';
    const billValue = String(printData.billNumber || '-').substring(0, 10); // Limit bill number length
    const userLabel = ' User : ';
    const userValue = String(printData.billBy || '-').substring(0, 15); // Limit user name length
    const billUserContent = billLabel + billValue + userLabel + userValue;
    const billUserPadding = Math.max(0, BILL_WIDTH - billUserContent.length);
    const billUserLine = billLabel + billValue + ' '.repeat(billUserPadding) + userLabel + userValue;
    // Ensure line doesn't exceed BILL_WIDTH
    pushLine(billUserLine.substring(0, BILL_WIDTH));
    pushLine(`Cus. Name: ${padRight(printData.customerName || '-', BILL_WIDTH - 11)}`);
    divider();
    const headerLine = `${padRight('SNo', 3)} ${padRight('Product', 15)} ${padLeft('MRP', 7)} ${padLeft('Qty', 4)} ${padLeft('Rate', 7)} ${padLeft('Amount', 7)}`;
    // Ensure header line doesn't exceed BILL_WIDTH
    pushLine(headerLine.substring(0, BILL_WIDTH));
    divider();
    const rateForDisplay = (item = {}) => {
      // Display saleRate (selling price) for the Rate column
      const parsed = Number.parseFloat(item.saleRate);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    printData.items.forEach((item = {}, index) => {
      const itemName = item.name || '';
      // Truncate long product names to maintain alignment
      const truncatedName = itemName.length > 15 ? itemName.substring(0, 12) + '...' : itemName;
      const itemLine = `${padRight(index + 1, 3)} ${padRight(truncatedName, 15)} ${padLeft(currency(item.mrp || 0), 7)} ${padLeft(qtyFormat(item.qty || 0), 4)} ${padLeft(currency(rateForDisplay(item)), 7)} ${padLeft(currency(item.netAmount || 0), 7)}`;
      // Ensure line doesn't exceed BILL_WIDTH
      pushLine(itemLine.substring(0, BILL_WIDTH));
    });
    divider();
    const totalQtyDisplay =
      Number.isFinite(Number(printData.totalQty)) && Number(printData.totalQty) > 0
        ? Number(printData.totalQty)
        : printData.items.length;
    // Align totals properly
    const totalItemText = `Total Item: ${totalQtyDisplay}`;
    const totalText = `Total: Rs. ${currency(printData.totalAmount)}`;
    const totalLineContent = totalItemText + totalText;
    const totalLinePadding = Math.max(0, BILL_WIDTH - totalLineContent.length);
    const totalLine = `${totalItemText}${' '.repeat(totalLinePadding)}${totalText}`;
    // Ensure line doesn't exceed BILL_WIDTH
    pushLine(totalLine.substring(0, BILL_WIDTH));
    if (printData.totalSavings > 0) {
      const savingsText = `Total Savings: ${currency(printData.totalSavings)}`;
      pushLine(savingsText);
    }
    divider();
    pushLine(''); // Empty line for spacing
    pushLine(centerText('Thank You! Visit Again'));
    pushLine(''); // Empty line for spacing

    const text = lines
      .map((line) => {
        if (line === DIVIDER_MARKER) {
          return '='.repeat(BILL_WIDTH);
        }
        // Truncate lines that exceed BILL_WIDTH, but don't pad shorter lines
        // (empty lines and naturally shorter lines are fine)
        if (line.length > BILL_WIDTH) {
          return line.substring(0, BILL_WIDTH);
        }
        return line;
      })
      .join('\n');

    const html = lines
      .map((line) => {
        if (line === DIVIDER_MARKER) {
          return '<div class="divider-line"></div>';
        }
        return `<div class="line">${escapeHtml(line)}</div>`;
      })
      .join('');

    return { formattedText: text, formattedHtml: html };
  }, [displayStoreName, printData]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=400,height=400');
    
    // ESC/POS commands for auto-cut and auto-stop
    // ESC i = Full cut (most common command)
    // GS V 0 = Full cut (alternative)
    // ESC d n = Feed n lines then stop (for auto-stop)
    // These commands are embedded in the print content for thermal printers
    const escPosCut = String.fromCharCode(0x1B, 0x69); // ESC i - Full cut
    const escPosStop = String.fromCharCode(0x1B, 0x64, 0x05); // ESC d 5 - Feed 5 lines then stop
    
    // Escape HTML in the formatted text for safe rendering
    const escapedText = formattedText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Bill - ${printData.billNumber}</title>
          <style>
            @page {
              size: 72mm auto; /* Fixed width, variable height */
              margin: 0;
              padding: 0;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body { 
              margin: 0; 
              padding: 0; 
              font-family: "Times New Roman", Times, serif; 
              font-size: 10px;
              line-height: 1.4;
              font-weight: bold;
              color: #000000;
              background: #FFFFFF;
              width: 72mm;
              max-width: 72mm;
            }
            .bill-content {
              width: 100%;
              max-width: 68mm;
              margin: 0 auto;
              padding: 4px 4px 8px 4px;
              box-sizing: border-box;
              font-family: "Times New Roman", Times, serif;
              font-size: 10px;
              line-height: 1.4;
              font-weight: bold;
              color: #000000;
              background: #FFFFFF;
              white-space: pre;
              word-break: keep-all;
              overflow-wrap: normal;
              text-align: center;
            }
            .printer-commands {
              display: none;
              font-family: "Times New Roman", Times, serif;
              white-space: pre;
            }
            @media print {
              @page {
                size: 72mm auto;
                margin: 0;
                padding: 0;
              }
              body { 
                margin: 0; 
                padding: 0;
                width: 72mm;
                max-width: 72mm;
                font-family: "Times New Roman", Times, serif;
                font-weight: bold;
                color: #000000;
                background: #FFFFFF;
              }
              .bill-content { 
                padding: 4px 4px 8px 4px;
                width: 100%;
                max-width: 68mm;
                margin: 0 auto;
                font-family: "Times New Roman", Times, serif;
                font-size: 10px;
                line-height: 1.4;
                font-weight: bold;
                color: #000000;
                background: #FFFFFF;
                white-space: pre;
                word-break: keep-all;
                overflow-wrap: normal;
                text-align: center;
              }
              /* Force page break and cut after content */
              .printer-commands {
                display: block;
                page-break-after: always;
              }
            }
          </style>
        </head>
        <body>
          <pre class="bill-content">${escapedText}</pre>
          <div class="printer-commands">${escPosCut}${escPosStop}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      // Close window after print dialog
      setTimeout(() => {
        printWindow.close();
      }, 1000);
    }, 500);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Modal Header - Mobile Responsive */}
        <div className="flex items-center justify-between p-3 md:p-4 border-b bg-gray-50">
          <h2 className="text-base md:text-lg font-semibold text-gray-800">Bill Receipt</h2>
          <div className="flex gap-1 md:gap-2">
            <Button onClick={handlePrint} size="sm" variant="outline" className="text-xs md:text-sm">
              <Printer className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Print</span>
            </Button>
            <Button onClick={onClose} size="sm" variant="ghost" className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Bill Content - Mobile Responsive */}
        <div className="overflow-y-auto max-h-[calc(95vh-80px)] bg-gray-50 flex-1">
          <div className="flex justify-center p-4 md:p-6">
            <div className="bg-white shadow-md rounded-sm border border-gray-200 w-full" style={{ minWidth: '320px', maxWidth: '500px' }}>
              <pre
                id="bill-content"
                className="p-4 md:p-6 font-mono text-xs md:text-sm leading-tight bg-white text-gray-900 overflow-x-auto"
                style={{
                  fontFamily: "'Times New Roman', Times, serif",
                  fontWeight: 'bold',
                  letterSpacing: '0.02em',
                  whiteSpace: 'pre',
                  wordBreak: 'keep-all',
                  overflowWrap: 'normal',
                  lineHeight: '1.4',
                  textAlign: 'center'
                }}
              >
{formattedText}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillModal;
