import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

/**
 * Generates an invoice PDF using pdf-lib and returns the Buffer.
 */
export async function generateInvoicePDF({
  orderId,
  date,
  userName,
  userMobile,
  courseName,
  bundleName,
  amount,
  discount,
  total,
  paymentStatus,
}: {
  orderId: string;
  date: string;
  userName: string;
  userMobile: string;
  courseName: string;
  bundleName: string;
  amount: number;
  discount: number;
  total: number;
  paymentStatus: string;
}): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 750]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const drawText = (text: string, x: number, y: number, size = 10, isBold = false) => {
    page.drawText(text, {
      x,
      y,
      size,
      font: isBold ? boldFont : font,
      color: rgb(15 / 255, 23 / 255, 42 / 255), // Dark Navy #0f172a
    });
  };

  // 1. Header (Brand Style)
  // Accent Tech Blue bar
  page.drawRectangle({
    x: 0,
    y: 720,
    width: 600,
    height: 30,
    color: rgb(0 / 255, 110 / 255, 255 / 255), // #006eff
  });

  drawText('ROBOAIAPATHS LMS - INVOICE', 40, 670, 20, true);
  
  // Invoice details
  drawText(`Invoice No: INV-${orderId.substring(0, 8).toUpperCase()}`, 40, 630, 11, true);
  drawText(`Date: ${date}`, 40, 615, 10);
  drawText(`Status: ${paymentStatus}`, 40, 600, 10, true);

  // Billing details
  drawText('Billed To:', 40, 560, 12, true);
  drawText(`Name: ${userName}`, 40, 540, 10);
  drawText(`Mobile: ${userMobile}`, 40, 525, 10);

  // Platform details
  drawText('Seller:', 380, 560, 12, true);
  drawText('RoboAIAPaths Pvt. Ltd.', 380, 540, 10);
  drawText('Support: info@roboaiapaths.com', 380, 525, 10);
  drawText('Website: roboaiapaths.com', 380, 510, 10);

  // Divider Line
  page.drawLine({
    start: { x: 40, y: 470 },
    end: { x: 560, y: 470 },
    thickness: 1,
    color: rgb(226 / 255, 232 / 255, 240 / 255), // Light Gray
  });

  // Table Headers
  drawText('Item Description', 40, 440, 11, true);
  drawText('Qty', 380, 440, 11, true);
  drawText('Amount (INR)', 470, 440, 11, true);

  // Table Row
  drawText(`${courseName} - ${bundleName}`, 40, 400, 10);
  drawText('1', 380, 400, 10);
  drawText(`Rs. ${amount.toFixed(2)}`, 470, 400, 10);

  // Divider Line
  page.drawLine({
    start: { x: 40, y: 370 },
    end: { x: 560, y: 370 },
    thickness: 1,
    color: rgb(226 / 255, 232 / 255, 240 / 255),
  });

  // Summary Table
  drawText('Subtotal:', 350, 330, 10, true);
  drawText(`Rs. ${amount.toFixed(2)}`, 470, 330, 10);

  drawText('Discount:', 350, 310, 10, true);
  drawText(`Rs. ${discount.toFixed(2)}`, 470, 310, 10);

  drawText('Total Paid:', 350, 280, 12, true);
  drawText(`Rs. ${total.toFixed(2)}`, 470, 280, 12, true);

  // Box around total
  page.drawRectangle({
    x: 340,
    y: 265,
    width: 220,
    height: 90,
    borderColor: rgb(0 / 255, 110 / 255, 255 / 255),
    borderWidth: 1,
  });

  // Footer / Terms
  drawText('Thank you for learning with RoboAIAPaths!', 40, 150, 12, true);
  drawText('This is a computer-generated invoice and requires no signature.', 40, 130, 9);

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Watermarks an existing PDF file by placing name, mobile, and timestamp on each page.
 * Returns the modified PDF Buffer.
 */
export async function watermarkPDF(filePath: string, watermarkText: string): Promise<Buffer> {
  const existingPdfBytes = fs.readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const page of pages) {
    const { width, height } = page.getSize();
    
    // Draw 3 watermarks on each page diagonally
    const drawSingleWatermark = (x: number, y: number) => {
      page.drawText(watermarkText, {
        x,
        y,
        size: 14,
        font: font,
        color: rgb(150 / 255, 150 / 255, 150 / 255),
        opacity: 0.15, // Extremely semi-transparent
        rotate: degrees(45),
      });
    };

    drawSingleWatermark(width * 0.2, height * 0.2);
    drawSingleWatermark(width * 0.5, height * 0.5);
    drawSingleWatermark(width * 0.3, height * 0.8);
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
