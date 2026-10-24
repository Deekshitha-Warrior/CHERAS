import React from 'react'
import { createRoot } from 'react-dom/client'
import { formatPhoneDisplay } from './phone'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { BRAND_ADDRESS, BRAND_EN, BRAND_PHONE_DISPLAY, BRAND_GSTIN } from './brand'
import { formatCurrency, formatQuantityDisplay, normalizeStructuredOrderItem, formatInvoiceNo } from './retail'
import { LOGO_BASE64 } from './logoBase64'
import { Invoice, type InvoiceProps, type AdvanceOrderPaymentInfo } from '../components/Invoice'

export type InvoicePdfData = {
  invoiceNo: string
  date: string
  customerName: string
  phone: string
  address: string
  items: Array<Record<string, unknown>>
  subtotal: number
  shipping: number
  total: number
  discount?: number
  discountAmount?: number
  couponDiscount?: number
  manualDiscount?: number
  manualDiscountAmount?: number
  gstAmount?: number
  cgstAmount?: number
  sgstAmount?: number
  gstRate?: number
  couponCode?: string | null
  paymentMode?: string
  advanceDetails?: AdvanceOrderPaymentInfo
  gstin?: string
}

// jsPDF's built-in Helvetica font does not include the ₹ Unicode glyph (U+20B9).
// In ISO-8859-1 (WinAnsiEncoding), \u20B9 maps to character code 185 (0xB9), which renders
// as the superscript 1 (¹) glyph. Replacing with "Rs. " ensures clean and proper PDF formatting.
const money = (value: number): string => {
  const formatted = formatCurrency(Number(value || 0)).replace(/\s+/g, ' ')
  return formatted.replace(/^[₹\u20b9]\s*/, 'Rs. ')
}

/** Creates a compact A4 invoice that can be attached as a file to WhatsApp. */
export function createInvoicePdf(data: InvoicePdfData): Blob {
  const formattedNo = formatInvoiceNo(data.invoiceNo)
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = 210
  const left = 16
  const right = 194
  const primaryColor = '#7B1E2B' // Cheras Deep Burgundy
  const goldColor = '#C9A24B' // Cheras Gold
  const ink = '#1F1F1F'
  const muted = '#6B7280'
  let y = 16

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(muted)
  doc.text('TAX INVOICE', left, y)
  doc.text(`Invoice: #${formattedNo}`, right, y, { align: 'right' })
  y += 7
  doc.setDrawColor('#F3F4F6')
  doc.line(left, y, right, y)
  y += 10

  doc.setFillColor(123, 30, 43)
  doc.circle(left + 11, y + 11, 10, 'F')
  doc.setDrawColor(201, 162, 75)
  doc.setLineWidth(0.6)
  doc.circle(left + 11, y + 11, 10, 'S')
  doc.setTextColor(201, 162, 75)
  doc.setFont('times', 'bold')
  doc.setFontSize(18)
  doc.text('C', left + 11, y + 16.5, { align: 'center' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(primaryColor)
  doc.text(BRAND_EN.toUpperCase(), left + 26, y + 5)
  doc.setFontSize(8)
  doc.setTextColor(muted)
  doc.setFont('helvetica', 'normal')
  doc.text(BRAND_ADDRESS, left + 26, y + 11, { maxWidth: 85 })
  doc.setFont('helvetica', 'bold')
  doc.text(`GSTIN: ${data.gstin || BRAND_GSTIN}`, left + 26, y + 20)
  doc.setFont('helvetica', 'normal')
  doc.text(`Phone: ${BRAND_PHONE_DISPLAY}`, left + 26, y + 24)
  doc.text(`Date: ${new Date(data.date).toLocaleDateString('en-IN')}`, right, y + 2, { align: 'right' })
  // Helvetica has no ₹ glyph: swap it for "Rs." and wrap long split-payment text so it stays inside the page
  const paymentText = `Payment: ${data.paymentMode || 'POS'}`.replace(/[₹₹]\s*/g, 'Rs. ')
  const paymentLines = doc.splitTextToSize(paymentText, 85) as string[]
  doc.text(paymentLines, right, y + 7, { align: 'right' })
  y += 32

  const customerName = String(data.customerName || 'Walk-in Customer').trim()
  const customerPhone = formatPhoneDisplay(data.phone) || '—'
  const customerAddress = String(data.address || '').trim()
  const customerNameLines = doc.splitTextToSize(customerName, 165) as string[]
  const customerAddressLines = customerAddress
    ? doc.splitTextToSize(`Address: ${customerAddress}`, 165) as string[]
    : []
  const customerBoxHeight = 19 + customerNameLines.length * 4 + customerAddressLines.length * 4

  doc.setFillColor('#FBFAF6')
  doc.roundedRect(left, y, right - left, customerBoxHeight, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(muted)
  doc.text('BILL TO', left + 5, y + 7)
  doc.setFontSize(10)
  doc.setTextColor(ink)
  doc.text(customerNameLines, left + 5, y + 13)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(muted)
  const phoneY = y + 13 + customerNameLines.length * 4 + 2
  doc.text(`Mobile Number: ${customerPhone}`, left + 5, phoneY)
  if (customerAddressLines.length > 0) {
    doc.text(customerAddressLines, left + 5, phoneY + 5)
  }
  y += customerBoxHeight + 9

  doc.setFillColor(123, 30, 43) // #7B1E2B
  doc.rect(left, y, right - left, 9, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(201, 162, 75) // #C9A24B
  doc.text('#', left + 4, y + 6)
  doc.text('ITEM / SKU', left + 14, y + 6)
  doc.text('QTY', 140, y + 6, { align: 'right' })
  doc.text('RATE', 166, y + 6, { align: 'right' })
  doc.text('AMOUNT', right - 4, y + 6, { align: 'right' })
  y += 14

  data.items.forEach((raw, index) => {
    const item = normalizeStructuredOrderItem(raw)
    if (y > 260) { doc.addPage(); y = 20 }
    const name = item.name || 'Item'
    const nameLines = doc.splitTextToSize(name, 105) as string[]
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(ink)
    doc.text(String(index + 1), left + 4, y)
    doc.text(nameLines, left + 14, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(muted)
    doc.text(`${formatQuantityDisplay(item.quantity, item.unit, item.unit_type)}`, 140, y, { align: 'right' })
    doc.text(money(item.base_price), 166, y, { align: 'right' })
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(ink)
    doc.text(money(item.line_total), right - 4, y, { align: 'right' })
    y += Math.max(10, nameLines.length * 4 + 4)
    doc.setDrawColor('#F3F4F6')
    doc.line(left, y - 3, right, y - 3)
  })

  y = Math.max(y + 6, 150)
  const rows: Array<[string, string, string]> = [['Subtotal', money(data.subtotal), ink]]
  const couponDisc = (data.couponDiscount ?? data.discountAmount ?? 0)
  const manualDisc = (data.manualDiscount ?? data.manualDiscountAmount ?? 0)
  const rawCgst = data.cgstAmount ?? (data.gstAmount ? Math.round(((data.gstAmount || 0) / 2) * 100) / 100 : 0)
  const rawSgst = data.sgstAmount ?? (data.gstAmount ? Math.round(((data.gstAmount || 0) / 2) * 100) / 100 : 0)
  const totalTax = (rawCgst + rawSgst) || Number(data.gstAmount || 0)
  const taxableBase = (Number(data.subtotal) || 0) - couponDisc - manualDisc
  const resolvedGstRate = Number(data.gstRate || 0) || (totalTax > 0 && taxableBase > 0 ? Math.round((totalTax / taxableBase) * 1000) / 10 : 0)
  const halfRateStr = resolvedGstRate > 0
    ? (resolvedGstRate / 2).toFixed(1).replace(/\.0$/, '')
    : (totalTax > 0 ? '2.5' : '')
  const rateLabel = halfRateStr ? ` (${halfRateStr}%)` : ''

  if (couponDisc > 0) rows.push([`Coupon Disc.${data.couponCode ? ` (${data.couponCode})` : ''}`, `-${money(couponDisc)}`, goldColor])
  if (manualDisc > 0) rows.push(['Manual Discount', `-${money(manualDisc)}`, goldColor])
  if (rawCgst > 0) rows.push([`CGST${rateLabel}`, `+${money(rawCgst)}`, ink])
  if (rawSgst > 0) rows.push([`SGST${rateLabel}`, `+${money(rawSgst)}`, ink])
  if (!rawCgst && !rawSgst && (data.gstAmount || 0) > 0) {
    rows.push([`GST${resolvedGstRate > 0 ? ` (${resolvedGstRate}%)` : ''}`, `+${money(data.gstAmount || 0)}`, ink])
  }
  if ((data.shipping || 0) > 0) rows.push(['Delivery Charges', `+${money(data.shipping)}`, ink])
  doc.setFontSize(9)
  rows.forEach(([label, value, color]) => { doc.setFont('helvetica', 'normal'); doc.setTextColor(color); doc.text(label, 143, y, { align: 'right' }); doc.text(value, right - 4, y, { align: 'right' }); y += 7 })
  doc.setDrawColor(201, 162, 75) // #C9A24B
  doc.setLineWidth(0.7)
  doc.line(118, y - 3, right, y - 3)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(primaryColor)
  doc.text('TOTAL', 143, y + 6, { align: 'right' })
  doc.text(money(data.total), right - 4, y + 6, { align: 'right' })
  y += 12

  if (data.advanceDetails) {
    const adv = data.advanceDetails
    y += 2
    doc.setDrawColor('#E5E7EB')
    doc.setLineWidth(0.4)
    doc.line(118, y, right, y)
    y += 5

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(primaryColor)
    doc.text('PAYMENT DETAILS', 122, y)
    y += 5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(muted)
    doc.text(adv.depositReceived ? 'Advance Paid' : 'Advance Due', 122, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(adv.depositReceived ? '#15803D' : '#B91C1C')
    doc.text(money(adv.depositAmount), right - 4, y, { align: 'right' })
    y += 4

    if (adv.depositPaymentLabel) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(muted)
      const depLines = doc.splitTextToSize(`(${adv.depositPaymentLabel})`.replace(/[₹₹]\s*/g, 'Rs. '), 68) as string[]
      doc.text(depLines, 122, y)
      y += depLines.length * 3 + 1
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(adv.balanceReceived ? muted : '#B45309')
    doc.text(adv.balanceReceived ? 'Balance Paid' : 'Balance Due', 122, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(adv.balanceReceived ? '#15803D' : '#B45309')
    doc.text(money(adv.balanceAmount), right - 4, y, { align: 'right' })
    y += 4

    if (adv.balanceReceived && adv.balancePaymentLabel) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(muted)
      const balLines = doc.splitTextToSize(`(${adv.balancePaymentLabel})`.replace(/[₹₹]\s*/g, 'Rs. '), 68) as string[]
      doc.text(balLines, 122, y)
      y += balLines.length * 3 + 1
    } else if (!adv.balanceReceived) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(6.5)
      doc.setTextColor('#B45309')
      doc.text('(Pending collection upon delivery)', 122, y)
      y += 4
    }

    doc.setDrawColor('#E5E7EB')
    doc.line(122, y, right - 4, y)
    y += 4

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(ink)
    doc.text('Remaining Balance', 122, y)
    doc.setTextColor(adv.balanceDue > 0 ? '#B45309' : '#15803D')
    doc.text(adv.balanceDue > 0 ? money(adv.balanceDue) : 'Rs. 0.00 (Settled)', right - 4, y, { align: 'right' })
  }

  y = 275
  doc.setDrawColor('#F3F4F6')
  doc.setLineWidth(0.2)
  doc.line(left, y, right, y)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(primaryColor)
  doc.text(`THANK YOU FOR SHOPPING AT ${BRAND_EN.toUpperCase()}!`, pageWidth / 2, y + 8, { align: 'center' })
  return doc.output('blob')
}

export function invoicePdfFile(data: InvoicePdfData): File {
  return new File([createInvoicePdf(data)], `Invoice-${formatInvoiceNo(data.invoiceNo)}.pdf`, { type: 'application/pdf' })
}

/** Captures the rendered invoice so the downloaded PDF matches the visible view and anchors footer to the bottom. */
export async function invoicePdfFileFromElement(
  element: HTMLElement,
  invoiceNo: string,
): Promise<File> {
  const formattedNo = formatInvoiceNo(invoiceNo)
  const invoiceRoot = (element.querySelector('#invoice-print-root') as HTMLElement) || element
  const canonicalWidth = 680
  const targetMinHeight = Math.round(canonicalWidth * (297 / 210)) // 962px (exact A4 ratio)

  try {
    const canvas = await html2canvas(invoiceRoot, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
      windowWidth: 1024,
      onclone: (_clonedDoc, clonedElement) => {
        const clonedInvoice =
          clonedElement.id === 'invoice-print-root'
            ? clonedElement
            : (clonedElement.querySelector('#invoice-print-root') as HTMLElement) || clonedElement
        clonedInvoice.style.width = `${canonicalWidth}px`
        clonedInvoice.style.minWidth = `${canonicalWidth}px`
        clonedInvoice.style.maxWidth = `${canonicalWidth}px`
        clonedInvoice.style.minHeight = `${targetMinHeight}px`
        clonedInvoice.style.boxSizing = 'border-box'
        clonedInvoice.style.margin = '0 auto'
      },
    })

    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
    const pageWidth = 210
    const pageHeight = 297
    const imageHeight = (canvas.height * pageWidth) / canvas.width
    const image = canvas.toDataURL('image/png')

    if (imageHeight <= pageHeight + 5) {
      doc.addImage(image, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST')
    } else {
      let offset = 0
      let page = 0
      while (offset < imageHeight) {
        if (page > 0) doc.addPage()
        doc.addImage(image, 'PNG', 0, -offset, pageWidth, imageHeight, undefined, 'FAST')
        offset += pageHeight
        page += 1
      }
    }

    return new File([doc.output('blob')], `Invoice-${formattedNo}.pdf`, { type: 'application/pdf' })
  } catch (error) {
    console.error('Failed to generate invoice PDF from element:', error)
    throw error
  }
}

/** Generates matching Cheras WhatsApp-format digital invoice PDF by rendering the Invoice component offscreen. */
export async function generateInvoicePdfFromData(props: InvoiceProps): Promise<File> {
  const formattedNo = formatInvoiceNo(props.invoiceNo)
  if (typeof document === 'undefined') {
    return invoicePdfFile({
      invoiceNo: props.invoiceNo,
      date: props.date,
      customerName: props.customerName || '',
      phone: props.phone || '',
      address: props.address || '',
      items: props.items as unknown as Array<Record<string, unknown>>,
      subtotal: props.subtotal,
      shipping: props.shipping || props.deliveryCharge || 0,
      total: props.total,
      discountAmount: props.discountAmount,
      couponDiscount: props.discountAmount,
      couponCode: props.couponCode,
      manualDiscountAmount: props.manualDiscountAmount,
      manualDiscount: props.manualDiscountAmount,
      gstAmount: props.gstAmount,
      cgstAmount: props.cgstAmount,
      sgstAmount: props.sgstAmount,
      gstRate: props.gstRate,
      paymentMode: props.paymentMode,
      gstin: props.gstin,
    })
  }

  const container = document.createElement('div')
  container.id = 'temp-invoice-render-container'
  container.style.position = 'fixed'
  container.style.left = '-9999px'
  container.style.top = '0'
  container.style.width = '680px'
  container.style.zIndex = '-99999'
  container.style.background = '#ffffff'
  container.style.opacity = '1'
  container.style.pointerEvents = 'none'
  document.body.appendChild(container)

  const root = createRoot(container)
  root.render(React.createElement(Invoice, props))

  // Allow DOM rendering and styling calculation
  await new Promise(resolve => setTimeout(resolve, 250))

  try {
    const file = await invoicePdfFileFromElement(container, formattedNo)
    return file
  } finally {
    try {
      root.unmount()
      container.remove()
    } catch {
      // ignore cleanup errors
    }
  }
}
