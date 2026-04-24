import React, { useMemo, useState, useEffect } from 'react';
import { X, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { usersAPI } from '@/services/api';

const BillModal = ({ isOpen, onClose, billData, isAdmin = false }) => {
  const { selectedStore } = useAuth();
  // Snapshot bill when modal opens so MRP (and rest) don't get overwritten by later parent updates
  const [snapshot, setSnapshot] = useState(null);
  // Fetched store details (address, phone) so we always show saved values
  const [storeDetails, setStoreDetails] = useState(null);

  useEffect(() => {
    if (!isOpen || !billData) {
      setSnapshot(null);
      return;
    }
    const id = billData.id ?? billData.billId;
    const no = billData.billNo ?? billData.bill_no;
    setSnapshot((prev) => {
      if (prev != null && prev.id === id && prev.billNo === no) return prev;
      return JSON.parse(JSON.stringify(billData));
    });
  }, [isOpen, billData]);

  // Fetch full store details when modal opens so address and phone are shown from saved data
  useEffect(() => {
    if (!isOpen) {
      setStoreDetails(null);
      return;
    }
    let cancelled = false;
    usersAPI
      .getSelectedStore()
      .then((res) => {
        if (cancelled) return;
        const store = res?.data?.selectedStore ?? res?.selectedStore ?? null;
        setStoreDetails(store || null);
      })
      .catch(() => {
        if (!cancelled) setStoreDetails(null);
      });
    return () => { cancelled = true; };
  }, [isOpen]);

  const data = snapshot ?? billData;
  // Prefer fetched store details for address/phone so we show saved values
  const storeForBill = storeDetails ?? selectedStore;

  const printData = useMemo(() => {
    if (!data) {
      return {
        storeName: '',
        address: '',
        phone: '',
        gstNumber: '',
        date: '',
        time: '',
        billNumber: '',
        customerName: '',
        customerAddress: '',
        customerGstin: '',
        billBy: '',
        subtotal: 0,
        discountAmount: 0,
        tax: 0,
        totalAmount: 0,
        totalQty: 0,
        totalSavings: 0,
        items: [],
        gstBreakdown: [],
        notes: ''
      };
    }
    const fallbackDate = new Date();
    const rawDate = data?.date ? new Date(data.date) : fallbackDate;
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

    const normalizedItems = Array.isArray(data?.items)
      ? data.items.map((item) => {
          const quantity = Number.parseFloat(item.quantity ?? item.qty ?? 1);
          // Rate should be the selling price used in Items screen.
          // Accept common server/client field names.
          const sellingPrice =
            toNumber(
              item.sellingPrice ??
                item.unitPrice ??
                item.price
            ) ?? 0;
          // MRP should be the item's MRP as saved in the bill - check all possible field names
          // Priority: mrp > MRP > maxRetailPrice > max_retail_price
          // Don't use price fields (originalPrice, Price) as they might be different
          let mrp = null;
          
          // Check all possible MRP field names in order of priority
          if (item.mrp !== undefined && item.mrp !== null) {
            mrp = toNumber(item.mrp);
          } else if (item.MRP !== undefined && item.MRP !== null) {
            mrp = toNumber(item.MRP);
          } else if (item.maxRetailPrice !== undefined && item.maxRetailPrice !== null) {
            mrp = toNumber(item.maxRetailPrice);
          } else if (item.max_retail_price !== undefined && item.max_retail_price !== null) {
            mrp = toNumber(item.max_retail_price);
          }
          
          // If MRP is missing or invalid, leave as 0 (do not substitute selling price)
          if (mrp === null || mrp < 0) {
            mrp = 0;
          }
          
          const discount = Number.isFinite(Number.parseFloat(item.discount))
            ? Number.parseFloat(item.discount)
            : 0;
          const total = Number.isFinite(Number.parseFloat(item.total))
            ? Number.parseFloat(item.total)
            : Number((quantity * sellingPrice - discount).toFixed(2));

          return {
            name: item.itemName ?? item.name ?? 'Item',
            mrp: mrp, // Use the actual MRP value from the bill data
            // saleRate is used as "Rate" in print; set to selling price
            saleRate: sellingPrice,
            price: sellingPrice,
            originalPrice: toNumber(item.originalPrice ?? item.Price ?? item.price),
            qty: quantity,
            netAmount: total
          };
        })
      : [];

    const printableItems = normalizedItems.length > 0 ? normalizedItems : data?.items ?? [];

    const subtotal =
      typeof data?.subtotal === 'number'
        ? data.subtotal
        : normalizedItems.reduce((sum, item) => sum + item.saleRate * item.qty, 0);
    const discountValue =
      typeof data?.discount === 'number'
        ? data.discount
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
    const taxValue = typeof data?.tax === 'number' ? data.tax : 0;
    const totalAmount =
      typeof data?.total === 'number'
        ? data.total
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
      Number.isFinite(Number(data?.totalSavings))
        ? Number(data.totalSavings)
        : computedSavings;

    const billBy =
      data?.userName ??
      data?.billBy ??
      data?.cashierName ??
      (data?.userEmail ? data.userEmail : '');

    // Build store address: from bill data, or from storeForBill (fetched store or context)
    const storeAddressFromStore = (() => {
      if (data?.address && typeof data.address === 'string') return data.address.trim();
      if (data?.address && typeof data.address === 'object') {
        const parts = [
          data.address.street ?? data.address.addressLine1 ?? data.address.address_line_1,
          data.address.city ?? data.address.addressCity ?? data.address.address_city,
          data.address.state ?? data.address.addressState ?? data.address.address_state,
          data.address.zipCode ?? data.address.zip ?? data.address.pincode ?? data.address.addressZipCode ?? data.address.address_zip
        ].filter(Boolean);
        return parts.join(', ');
      }
      if (storeForBill?.address) {
        if (typeof storeForBill.address === 'string') return storeForBill.address.trim();
        const parts = [
          storeForBill.address.street ?? storeForBill.address.addressLine1,
          storeForBill.address.city ?? storeForBill.address.addressCity,
          storeForBill.address.state ?? storeForBill.address.addressState,
          storeForBill.address.zipCode ?? storeForBill.address.zip ?? storeForBill.address.pincode
        ].filter(Boolean);
        if (parts.length) return parts.join(', ');
      }
      // Flat store fields (e.g. from API: addressStreet, addressCity, addressState, addressZipCode)
      const flat = [
        storeForBill?.addressStreet ?? storeForBill?.address_line_1,
        storeForBill?.addressCity ?? storeForBill?.address_city,
        storeForBill?.addressState ?? storeForBill?.address_state,
        storeForBill?.addressZipCode ?? storeForBill?.addressZip ?? storeForBill?.pincode
      ].filter(Boolean);
      if (flat.length) return flat.join(', ');
      return '';
    })();

    // Resolve store phone from bill data or storeForBill (multiple possible field names)
    const storePhone = (() => {
      const raw =
        data?.phone ??
        data?.storePhone ??
        storeForBill?.phone ??
        storeForBill?.phoneNumber ??
        storeForBill?.mobile ??
        storeForBill?.contactNumber ??
        storeForBill?.primaryPhone ??
        (storeForBill?.contact && typeof storeForBill.contact === 'string' ? storeForBill.contact : null) ??
        '';
      const str = String(raw || '').trim();
      return str ? (str.toLowerCase().startsWith('ph') || str.startsWith('+') ? str : `Ph: ${str}`) : '';
    })();

    return {
      storeName: storeForBill?.name ?? data?.storeName ?? 'Murugan Super Market',
      address: storeAddressFromStore,
      phone: storePhone,
      gstNumber: data?.gstNumber ?? storeForBill?.gstNumber ?? '',
      date: formattedDate,
      time: formattedTime,
      billNumber: data?.billNo ?? data?.billNumber ?? '',
      customerName: (data?.customerName ?? data?.customer_name ?? '').toString().trim(),
      customerAddress: data?.customerAddress ?? data?.addressLine ?? '',
      customerGstin: data?.customerGstin ?? data?.gstin ?? data?.gstNumber ?? '',
      billBy: billBy,
      subtotal,
      discountAmount: discountValue,
      tax: taxValue,
      totalAmount,
      totalQty,
      totalSavings,
      items: printableItems,
      gstBreakdown:
        Array.isArray(data?.gstBreakdown) && data.gstBreakdown.length > 0
          ? data.gstBreakdown
          : [],
      notes: data?.notes ?? ''
    };
  }, [data, storeDetails, selectedStore]);

  const displayStoreName =
    storeForBill?.name || data?.storeName || printData.storeName || 'Murugan Super Market';

  const BILL_WIDTH = 56; // Width to show all details fully including full Amount header and values (104mm paper)
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

  const padCenter = (text = '', width = 0) => {
    const str = text.toString();
    if (str.length >= width) return str.slice(0, width);
    const padding = width - str.length;
    const left = Math.floor(padding / 2);
    const right = padding - left;
    return `${' '.repeat(left)}${str}${' '.repeat(right)}`;
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

    const { formattedText, formattedHtml, receiptHeaderText, receiptFooterText, receiptFooterBeforeTotal, receiptFooterAfterTotal } = useMemo(() => {
    const lines = [];
    const pushLine = (value = '') => lines.push(value);
    const divider = () => pushLine(DIVIDER_MARKER);

    pushLine(''); // Empty line for spacing
    pushLine(centerText(printData.storeName || displayStoreName));
    if (printData.gstNumber && String(printData.gstNumber).trim()) {
      pushLine(centerText(`GST IN: ${printData.gstNumber}`));
    }
    pushLine(centerText(printData.address ? printData.address : 'Address: -'));
    pushLine(centerText(printData.phone ? printData.phone : 'Ph: -'));
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
    // Header with proper column widths: SNo(3) Product(24) MRP(6) Qty(4) Rate(7) Amount(7)
    // Total: 3+1+24+1+6+1+4+1+7+1+7 = 56 characters (perfect fit for 104mm paper with extra space at end)
    // All numeric columns (SNo, MRP, Qty, Rate, Amount) should be right-aligned
    // Product shows full name: one line if ≤24 chars, else wrapped with numbers on last line
    const PRODUCT_COL_WIDTH = 24;
    const MRP_START = 3 + 1 + PRODUCT_COL_WIDTH + 1; // 29 - column start for MRP
    const numbersLinePrefixLen = MRP_START; // spaces before MRP on continuation line
    const lastChunkMaxLen = numbersLinePrefixLen - 4; // 25 - "    " (4) + product part before numbers
    const firstChunkMaxLen = 52; // 56 - 4 for "  1 " so first line stays ≤ BILL_WIDTH
    const headerLine = `${padLeft('SNo', 3)} ${padRight('Product', 24)} ${padLeft('MRP', 6)} ${padLeft('Qty', 4)} ${padLeft('Rate', 7)} ${padLeft('Amount', 7)}`;
    pushLine(headerLine);
    divider();
    pushLine('');
    const rateForDisplay = (item = {}) => {
      const parsed = Number.parseFloat(item.saleRate);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    printData.items.forEach((item = {}, index) => {
      const itemName = (item.name || '').trim();
      const sno = String(index + 1);
      const mrpStr = currency(item.mrp ?? item.MRP ?? 0);
      const qtyStr = qtyFormat(item.qty || 0);
      const rateStr = currency(rateForDisplay(item));
      const amountStr = currency(item.netAmount || 0);
      const numbersPart = `${padLeft(mrpStr, 6)} ${padLeft(qtyStr, 4)} ${padLeft(rateStr, 7)} ${padLeft(amountStr, 7)}`;

      if (itemName.length <= PRODUCT_COL_WIDTH) {
        const itemLine = `${padLeft(sno, 3)} ${padRight(itemName, 24)} ${numbersPart}`;
        pushLine(itemLine);
        return;
      }

      // Full product name: wrap so we never truncate. Numbers on same line only when name fits in 25 chars.
      const chunks = [];
      if (itemName.length <= firstChunkMaxLen) {
        chunks.push(itemName);
      } else {
        chunks.push(itemName.substring(0, firstChunkMaxLen));
        let pos = firstChunkMaxLen;
        while (pos < itemName.length) {
          chunks.push(itemName.substring(pos, Math.min(pos + lastChunkMaxLen, itemName.length)));
          pos += lastChunkMaxLen;
        }
      }
      chunks.forEach((chunk, i) => {
        const isLast = i === chunks.length - 1;
        const isOnlyChunk = chunks.length === 1;
        if (isLast) {
          const prefix = isOnlyChunk ? `${padLeft(sno, 3)} ` : '    ';
          if (chunk.length <= lastChunkMaxLen && isOnlyChunk) {
            // Name fits on one line with numbers
            const line = `${prefix}${padRight(chunk, lastChunkMaxLen)}${numbersPart}`;
            pushLine(line.length > BILL_WIDTH ? line.substring(0, BILL_WIDTH) : line);
          } else if (isOnlyChunk && chunk.length > lastChunkMaxLen) {
            // Long single name: wrap like modal - first part line 1, rest of name + numbers on line 2
            const firstPart = chunk.substring(0, PRODUCT_COL_WIDTH);
            const restPart = chunk.substring(PRODUCT_COL_WIDTH);
            const line1 = (prefix + firstPart).substring(0, BILL_WIDTH);
            pushLine(line1.length < BILL_WIDTH ? padRight(line1, BILL_WIDTH) : line1);
            pushLine('    ' + padRight(restPart, lastChunkMaxLen) + numbersPart);
          } else {
            // Multiple chunks: full last chunk on one line, numbers on next
            const nameLine = (prefix + chunk).substring(0, BILL_WIDTH);
            pushLine(nameLine.length < BILL_WIDTH ? padRight(nameLine, BILL_WIDTH) : nameLine);
            pushLine(padRight('', numbersLinePrefixLen) + numbersPart);
          }
        } else {
          const prefix = i === 0 ? `${padLeft(sno, 3)} ` : '    ';
          const wrapLine = (prefix + chunk).substring(0, BILL_WIDTH);
          pushLine(wrapLine.length < BILL_WIDTH ? padRight(wrapLine, BILL_WIDTH) : wrapLine);
        }
      });
    });
    // Add a blank line after items for better spacing
    pushLine('');
    divider();
    const totalQtyDisplay =
      Number.isFinite(Number(printData.totalQty)) && Number(printData.totalQty) > 0
        ? Number(printData.totalQty)
        : printData.items.length;
    // Align totals properly - Amount column ends at position: 3+1+24+1+6+1+4+1+7 = 48
    // Amount column width is 7, so it spans positions 48-55 (0-indexed: 48-54)
    // Total text should align with Amount column (right-aligned at position 55)
    const totalItemText = `Total Item: ${totalQtyDisplay}`;
    const totalText = `Total: Rs. ${currency(printData.totalAmount)}`;
    // Calculate padding to align Total with Amount column (right edge at position 55)
    const amountColumnStart = 3 + 1 + 24 + 1 + 6 + 1 + 4 + 1 + 7; // 48
    const amountColumnEnd = amountColumnStart + 7; // 55
    const totalTextStart = amountColumnEnd - totalText.length;
    const paddingNeeded = Math.max(0, totalTextStart - totalItemText.length);
    const totalLine = `${totalItemText}${' '.repeat(paddingNeeded)}${totalText}`;
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

    // Split for modal: header, item line range, footer (so we can render items as a table in the modal)
    // End header before the "SNo Product..." line so the modal shows only the table header (no duplicate)
    const headerEnd = lines.findIndex((l) => typeof l === 'string' && l.includes('SNo') && l.includes('Product'));
    const footerStart = lines.findIndex((l) => typeof l === 'string' && l.includes('Total Item'));
    const footerLines = footerStart >= 0 ? lines.slice(footerStart) : [];
    const mapLine = (line) => (line === DIVIDER_MARKER ? '='.repeat(BILL_WIDTH) : line);
    const receiptHeaderText =
      headerEnd > 0
        ? lines
            .slice(0, headerEnd)
            .map(mapLine)
            .join('\n')
        : '';
    const receiptFooterText =
      footerLines.length > 0 ? footerLines.map(mapLine).join('\n') : '';
    // For modal: show only "Total: Rs." line in larger bold; rest of footer unchanged
    const firstFooterLine = footerLines[0];
    const receiptFooterBeforeTotal =
      typeof firstFooterLine === 'string'
        ? firstFooterLine.replace(/\s*Total: Rs\.\s*[\d.]+$/, '').trimEnd()
        : '';
    const receiptFooterAfterTotal =
      footerLines.length > 1 ? footerLines.slice(1).map(mapLine).join('\n') : '';

    return {
      formattedText: text,
      formattedHtml: html,
      receiptHeaderText,
      receiptFooterText,
      receiptFooterBeforeTotal,
      receiptFooterAfterTotal
    };
  }, [displayStoreName, printData]);

  if (!isOpen) return null;

  // Render receipt text with full-width divider lines in the modal (pre content is only 56 chars wide)
  const renderTextWithFullWidthDividers = (text, preClassName, preStyle) => {
    if (!text) return null;
    const lines = text.split('\n');
    const out = [];
    let buffer = [];
    const flushPre = () => {
      if (buffer.length > 0) {
        out.push(
          <pre key={`pre-${out.length}`} className={preClassName} style={preStyle}>
            {buffer.join('\n')}
          </pre>
        );
        buffer = [];
      }
    };
    lines.forEach((line) => {
      if (line.trim().match(/^=+$/)) {
        flushPre();
        out.push(
          <div key={`div-${out.length}`} className="w-full border-t-2 border-gray-600 my-0.5 min-h-[2px]" aria-hidden />
        );
      } else {
        buffer.push(line);
      }
    });
    flushPre();
    return out;
  };

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
              size: 104mm auto;
              margin: 0;
              padding: 0;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            body { 
              margin: 0; 
              padding: 0; 
              font-family: "Courier New", Courier, monospace; 
              font-size: 11px;
              line-height: 1.25;
              font-weight: bold;
              color: #000000;
              background: #FFFFFF;
              width: 104mm;
              max-width: 104mm;
              height: auto;
              overflow: visible;
            }
            .bill-content {
              width: 98mm;
              max-width: 98mm;
              margin: 0 3mm;
              padding: 4px 0 4px 0;
              box-sizing: border-box;
              font-family: "Courier New", Courier, monospace;
              font-size: 11px;
              line-height: 1.25;
              font-weight: bold;
              color: #000000;
              background: #FFFFFF;
              white-space: pre;
              word-break: keep-all;
              overflow-wrap: normal;
              text-align: left;
              height: auto;
              overflow: visible;
            }
            .printer-commands {
              display: none;
              font-family: "Times New Roman", Times, serif;
              white-space: pre;
            }
            @media print {
              @page {
                size: 104mm auto;
                margin: 0 !important;
                padding: 0 !important;
              }
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              html, body { 
                margin: 0 !important; 
                padding: 0 !important;
                width: 104mm !important;
                max-width: 104mm !important;
                min-width: 104mm !important;
                font-family: "Courier New", Courier, monospace !important;
                font-size: 11px !important;
                line-height: 1.25 !important;
                font-weight: bold !important;
                color: #000000 !important;
                background: #FFFFFF !important;
                height: auto !important;
                overflow: visible !important;
              }
              .bill-content { 
                padding: 4px 0 4px 0 !important;
                width: 98mm !important;
                max-width: 98mm !important;
                min-width: 98mm !important;
                margin: 0 3mm !important;
                font-family: "Courier New", Courier, monospace !important;
                font-size: 11px !important;
                line-height: 1.25 !important;
                font-weight: bold !important;
                color: #000000 !important;
                background: #FFFFFF !important;
                white-space: pre !important;
                word-break: keep-all !important;
                overflow-wrap: normal !important;
                text-align: left !important;
                transform: scale(1) !important;
                height: auto !important;
                overflow: visible !important;
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

        {/* Bill Content - Mobile Responsive: table for items so Product column stays aligned */}
        <div className="overflow-y-auto max-h-[calc(95vh-80px)] bg-gray-50 flex-1">
          <div className="flex justify-center p-4 md:p-6">
            <div className="bg-white shadow-md rounded-sm border border-gray-200 w-full font-mono text-xs md:text-sm" style={{ minWidth: '320px', maxWidth: '600px' }}>
              <div className="p-4 md:p-6">
                {receiptHeaderText &&
                  renderTextWithFullWidthDividers(
                    receiptHeaderText,
                    'leading-tight bg-white text-gray-900 font-bold whitespace-pre mb-0',
                    { fontFamily: "'Courier New', Courier, monospace", lineHeight: '1.3' }
                  )}
                <table className="w-full border-collapse font-bold text-gray-900" style={{ tableLayout: 'fixed' }}>
                  <thead>
                    <tr className="border-b border-gray-300">
                      <th className="text-left py-1 pr-1 w-8">SNo</th>
                      <th className="text-left py-1 pr-2" style={{ width: '45%', minWidth: '10ch' }}>Product</th>
                      <th className="text-right py-1 pr-1 w-14">MRP</th>
                      <th className="text-right py-1 pr-1 w-10">Qty</th>
                      <th className="text-right py-1 pr-1 w-14">Rate</th>
                      <th className="text-right py-1 w-14">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(printData.items || []).map((item, index) => {
                      const rate = Number.isFinite(Number(item.saleRate)) ? Number(item.saleRate) : Number(item.price) || 0;
                      const amt = Number.isFinite(Number(item.netAmount)) ? Number(item.netAmount) : (item.qty || 1) * rate;
                      return (
                        <tr key={index} className="border-b border-gray-100">
                          <td className="py-1 pr-1 align-top">{index + 1}</td>
                          <td className="py-1 pr-2 align-top break-words" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                            {(() => {
                              const name = (item.name || 'Item').trim();
                              // Keep "FCOFFEE 200G" (or similar product + weight) on same line when wrapping:
                              // use non-breaking space before trailing weight/size (e.g. 200G, 1L, 500G)
                              const withKeptSuffix = name.replace(/\s+(\d+(?:\.\d+)?\s*(?:G|ML|L|KG|GM|ML)\s*)$/i, '\u00A0$1');
                              return withKeptSuffix;
                            })()}
                          </td>
                          <td className="text-right py-1 pr-1 align-top">₹{Number(item.mrp ?? item.MRP ?? 0).toFixed(2)}</td>
                          <td className="text-right py-1 pr-1 align-top">{Number.isInteger(Number(item.qty)) ? item.qty : Number(item.qty).toFixed(2)}</td>
                          <td className="text-right py-1 pr-1 align-top">₹{rate.toFixed(2)}</td>
                          <td className="text-right py-1 align-top">₹{amt.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {/* Footer: only "Total: Rs." in larger bold, rest unchanged */}
                {(receiptFooterBeforeTotal || receiptFooterAfterTotal) && (
                  <pre
                    className="leading-tight bg-white text-gray-900 font-bold whitespace-pre mt-0 mb-0"
                    style={{
                      fontFamily: "'Courier New', Courier, monospace",
                      lineHeight: '1.3'
                    }}
                  >
                    {receiptFooterBeforeTotal}
                  </pre>
                )}
                {receiptFooterText && (
                  <div
                    className="font-bold text-base md:text-lg text-gray-900 font-mono text-right"
                    style={{ fontFamily: "'Courier New', Courier, monospace" }}
                  >
                    Total: Rs. {Number(printData.totalAmount).toFixed(2)}
                  </div>
                )}
                {receiptFooterAfterTotal &&
                  renderTextWithFullWidthDividers(
                    receiptFooterAfterTotal,
                    'leading-tight bg-white text-gray-900 font-bold whitespace-pre mt-0',
                    { fontFamily: "'Courier New', Courier, monospace", lineHeight: '1.3' }
                  )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillModal;