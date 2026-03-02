"""
PDF Generation Service for Reports and Invoices
"""
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, HRFlowable
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from io import BytesIO
from datetime import datetime
from typing import List, Dict, Any, Optional


class PDFGenerator:
    """Generate professional PDFs for invoices and reports"""
    
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
    
    def _setup_custom_styles(self):
        """Setup custom paragraph styles"""
        self.styles.add(ParagraphStyle(
            name='Title_Custom',
            parent=self.styles['Heading1'],
            fontSize=24,
            spaceAfter=30,
            textColor=colors.HexColor('#1e3a5f')
        ))
        self.styles.add(ParagraphStyle(
            name='Subtitle',
            parent=self.styles['Normal'],
            fontSize=12,
            textColor=colors.HexColor('#666666'),
            spaceAfter=20
        ))
        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Heading2'],
            fontSize=14,
            spaceBefore=20,
            spaceAfter=10,
            textColor=colors.HexColor('#1e3a5f')
        ))
        self.styles.add(ParagraphStyle(
            name='TableHeader',
            parent=self.styles['Normal'],
            fontSize=10,
            textColor=colors.white,
            alignment=TA_CENTER
        ))
        self.styles.add(ParagraphStyle(
            name='RightAlign',
            parent=self.styles['Normal'],
            alignment=TA_RIGHT
        ))
        self.styles.add(ParagraphStyle(
            name='Footer',
            parent=self.styles['Normal'],
            fontSize=8,
            textColor=colors.HexColor('#888888'),
            alignment=TA_CENTER
        ))

    def _get_header_table_style(self):
        """Standard header table style"""
        return TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a5f')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('TOPPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('ALIGN', (0, 1), (-1, -1), 'LEFT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dddddd')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')]),
            ('TOPPADDING', (0, 1), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
        ])

    def generate_invoice_pdf(self, invoice: Dict, company_settings: Dict) -> BytesIO:
        """Generate a professional invoice PDF"""
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer, 
            pagesize=A4,
            rightMargin=50,
            leftMargin=50,
            topMargin=50,
            bottomMargin=50
        )
        
        elements = []
        width = A4[0] - 100  # Account for margins
        
        # Company Header
        company_name = company_settings.get('company_name', 'Quick Wing Fleet Management')
        elements.append(Paragraph(company_name, self.styles['Title_Custom']))
        
        if company_settings.get('tagline'):
            elements.append(Paragraph(company_settings['tagline'], self.styles['Subtitle']))
        
        # Company address block
        address_parts = []
        if company_settings.get('address_line1'):
            address_parts.append(company_settings['address_line1'])
        if company_settings.get('address_line2'):
            address_parts.append(company_settings['address_line2'])
        city_postal = []
        if company_settings.get('city'):
            city_postal.append(company_settings['city'])
        if company_settings.get('postal_code'):
            city_postal.append(company_settings['postal_code'])
        if city_postal:
            address_parts.append(', '.join(city_postal))
        if company_settings.get('country'):
            address_parts.append(company_settings['country'])
        
        if address_parts:
            for part in address_parts:
                elements.append(Paragraph(part, self.styles['Normal']))
        
        # Contact info
        contact_parts = []
        if company_settings.get('phone'):
            contact_parts.append(f"Phone: {company_settings['phone']}")
        if company_settings.get('email'):
            contact_parts.append(f"Email: {company_settings['email']}")
        if company_settings.get('tax_id'):
            contact_parts.append(f"VAT: {company_settings['tax_id']}")
        
        if contact_parts:
            elements.append(Spacer(1, 10))
            elements.append(Paragraph(' | '.join(contact_parts), self.styles['Normal']))
        
        elements.append(Spacer(1, 30))
        elements.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#1e3a5f')))
        elements.append(Spacer(1, 20))
        
        # Invoice Title and Number
        elements.append(Paragraph(f"INVOICE", self.styles['Title_Custom']))
        elements.append(Paragraph(f"Invoice Number: {invoice.get('invoice_number', 'N/A')}", self.styles['Normal']))
        elements.append(Spacer(1, 20))
        
        # Invoice Details Table
        currency = company_settings.get('currency_symbol', '€')
        
        details_data = [
            ['Bill To:', 'Invoice Details:'],
            [invoice.get('tenant_name', 'N/A'), f"Issue Date: {invoice.get('issue_date', '')[:10]}"],
            ['', f"Due Date: {invoice.get('due_date', '')[:10]}"],
            ['', f"Status: {invoice.get('status', 'draft').upper()}"],
        ]
        
        details_table = Table(details_data, colWidths=[width/2, width/2])
        details_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#1e3a5f')),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        elements.append(details_table)
        elements.append(Spacer(1, 30))
        
        # Line Items Table
        elements.append(Paragraph("Line Items", self.styles['SectionHeader']))
        
        items_data = [['Description', 'Quantity', 'Unit Price', 'Amount']]
        for item in invoice.get('items', []):
            items_data.append([
                item.get('description', ''),
                str(item.get('quantity', 1)),
                f"{currency}{item.get('unit_price', 0):.2f}",
                f"{currency}{item.get('amount', 0):.2f}"
            ])
        
        items_table = Table(items_data, colWidths=[width*0.5, width*0.15, width*0.175, width*0.175])
        items_table.setStyle(self._get_header_table_style())
        items_table.setStyle(TableStyle([
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ]))
        elements.append(items_table)
        elements.append(Spacer(1, 20))
        
        # Totals
        totals_data = [
            ['', '', 'Subtotal:', f"{currency}{invoice.get('subtotal', 0):.2f}"],
            ['', '', f"Tax ({invoice.get('tax_rate', 0)}%):", f"{currency}{invoice.get('tax_amount', 0):.2f}"],
            ['', '', 'TOTAL:', f"{currency}{invoice.get('total', 0):.2f}"],
        ]
        
        totals_table = Table(totals_data, colWidths=[width*0.5, width*0.15, width*0.175, width*0.175])
        totals_table.setStyle(TableStyle([
            ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
            ('FONTNAME', (2, -1), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('FONTSIZE', (2, -1), (-1, -1), 12),
            ('TEXTCOLOR', (2, -1), (-1, -1), colors.HexColor('#1e3a5f')),
            ('LINEABOVE', (2, -1), (-1, -1), 1, colors.HexColor('#1e3a5f')),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(totals_table)
        
        # Notes
        if invoice.get('notes'):
            elements.append(Spacer(1, 30))
            elements.append(Paragraph("Notes:", self.styles['SectionHeader']))
            elements.append(Paragraph(invoice['notes'], self.styles['Normal']))
        
        # Payment Details
        if company_settings.get('bank_iban') or company_settings.get('bank_name'):
            elements.append(Spacer(1, 30))
            elements.append(Paragraph("Payment Details:", self.styles['SectionHeader']))
            if company_settings.get('bank_name'):
                elements.append(Paragraph(f"Bank: {company_settings['bank_name']}", self.styles['Normal']))
            if company_settings.get('bank_iban'):
                elements.append(Paragraph(f"IBAN: {company_settings['bank_iban']}", self.styles['Normal']))
            if company_settings.get('bank_bic'):
                elements.append(Paragraph(f"BIC: {company_settings['bank_bic']}", self.styles['Normal']))
        
        # Footer
        elements.append(Spacer(1, 40))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#dddddd')))
        elements.append(Spacer(1, 10))
        footer_text = company_settings.get('invoice_footer', 'Thank you for your business!')
        elements.append(Paragraph(footer_text, self.styles['Footer']))
        elements.append(Paragraph(f"Generated on {datetime.now().strftime('%Y-%m-%d %H:%M')}", self.styles['Footer']))
        
        doc.build(elements)
        buffer.seek(0)
        return buffer

    def generate_executive_summary_pdf(self, data: Dict, company_settings: Dict) -> BytesIO:
        """Generate Executive Summary Report PDF"""
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=50, leftMargin=50, topMargin=50, bottomMargin=50)
        
        elements = []
        width = A4[0] - 100
        
        # Header
        company_name = company_settings.get('company_name', 'Quick Wing Fleet Management')
        elements.append(Paragraph(company_name, self.styles['Title_Custom']))
        elements.append(Paragraph("Executive Summary Report", self.styles['Subtitle']))
        elements.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", self.styles['Normal']))
        elements.append(Spacer(1, 20))
        elements.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#1e3a5f')))
        elements.append(Spacer(1, 30))
        
        summary = data.get('summary', {})
        currency = company_settings.get('currency_symbol', '€')
        
        # Key Metrics Table
        elements.append(Paragraph("Key Metrics", self.styles['SectionHeader']))
        
        tenants = summary.get('tenants', {})
        revenue = summary.get('revenue', {})
        
        metrics_data = [
            ['Metric', 'Value'],
            ['Total Franchises', str(tenants.get('total', 0))],
            ['Active Franchises', str(tenants.get('active', 0))],
            ['Suspended Franchises', str(tenants.get('suspended', 0))],
            ['Total Users', str(summary.get('users', 0))],
            ['Total Vehicles', str(summary.get('vehicles', 0))],
            ['Total Bookings', str(summary.get('bookings', 0))],
            ['Revenue Collected', f"{currency}{revenue.get('total_collected', 0):.2f}"],
            ['Revenue Pending', f"{currency}{revenue.get('pending', 0):.2f}"],
            ['Overdue Invoices', str(revenue.get('overdue_invoices', 0))],
        ]
        
        metrics_table = Table(metrics_data, colWidths=[width*0.6, width*0.4])
        metrics_table.setStyle(self._get_header_table_style())
        metrics_table.setStyle(TableStyle([
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ]))
        elements.append(metrics_table)
        elements.append(Spacer(1, 30))
        
        # Plan Distribution
        elements.append(Paragraph("Plan Distribution", self.styles['SectionHeader']))
        plan_dist = summary.get('plan_distribution', {})
        
        if plan_dist:
            plan_data = [['Plan', 'Count']]
            for plan, count in plan_dist.items():
                plan_data.append([plan.capitalize(), str(count)])
            
            plan_table = Table(plan_data, colWidths=[width*0.6, width*0.4])
            plan_table.setStyle(self._get_header_table_style())
            plan_table.setStyle(TableStyle([
                ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ]))
            elements.append(plan_table)
        else:
            elements.append(Paragraph("No franchises registered yet.", self.styles['Normal']))
        
        elements.append(Spacer(1, 30))
        
        # Recent Franchises
        elements.append(Paragraph("Recent Franchises", self.styles['SectionHeader']))
        recent = data.get('recent_tenants', [])
        
        if recent:
            recent_data = [['Name', 'Slug', 'Status']]
            for tenant in recent:
                recent_data.append([
                    tenant.get('name', 'N/A'),
                    tenant.get('slug', 'N/A'),
                    tenant.get('status', 'N/A').upper()
                ])
            
            recent_table = Table(recent_data, colWidths=[width*0.45, width*0.35, width*0.2])
            recent_table.setStyle(self._get_header_table_style())
            elements.append(recent_table)
        else:
            elements.append(Paragraph("No recent franchises.", self.styles['Normal']))
        
        # Footer
        elements.append(Spacer(1, 40))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#dddddd')))
        elements.append(Spacer(1, 10))
        elements.append(Paragraph(f"Report generated by {company_name}", self.styles['Footer']))
        
        doc.build(elements)
        buffer.seek(0)
        return buffer

    def generate_franchises_report_pdf(self, data: Dict, company_settings: Dict) -> BytesIO:
        """Generate Franchises Report PDF"""
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=40, leftMargin=40, topMargin=50, bottomMargin=50)
        
        elements = []
        width = A4[0] - 80
        
        # Header
        company_name = company_settings.get('company_name', 'Quick Wing Fleet Management')
        elements.append(Paragraph(company_name, self.styles['Title_Custom']))
        elements.append(Paragraph("Franchises Report", self.styles['Subtitle']))
        elements.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", self.styles['Normal']))
        elements.append(Paragraph(f"Total Franchises: {data.get('total', 0)}", self.styles['Normal']))
        elements.append(Spacer(1, 20))
        elements.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#1e3a5f')))
        elements.append(Spacer(1, 20))
        
        currency = company_settings.get('currency_symbol', '€')
        franchises = data.get('franchises', [])
        
        if franchises:
            # Table headers
            table_data = [['Franchise', 'Status', 'Plan', 'Users', 'Vehicles', 'Billed', 'Balance']]
            
            for f in franchises:
                stats = f.get('stats', {})
                table_data.append([
                    f.get('name', 'N/A')[:25],
                    f.get('status', 'N/A').upper(),
                    f.get('plan', 'N/A').capitalize(),
                    str(stats.get('users', 0)),
                    str(stats.get('vehicles', 0)),
                    f"{currency}{stats.get('total_billed', 0):.0f}",
                    f"{currency}{stats.get('balance_due', 0):.0f}"
                ])
            
            col_widths = [width*0.25, width*0.12, width*0.13, width*0.1, width*0.1, width*0.15, width*0.15]
            franchises_table = Table(table_data, colWidths=col_widths)
            franchises_table.setStyle(self._get_header_table_style())
            franchises_table.setStyle(TableStyle([
                ('ALIGN', (3, 0), (-1, -1), 'RIGHT'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
            ]))
            elements.append(franchises_table)
        else:
            elements.append(Paragraph("No franchises found.", self.styles['Normal']))
        
        # Footer
        elements.append(Spacer(1, 40))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#dddddd')))
        elements.append(Spacer(1, 10))
        elements.append(Paragraph(f"Report generated by {company_name}", self.styles['Footer']))
        
        doc.build(elements)
        buffer.seek(0)
        return buffer

    def generate_invoices_report_pdf(self, data: Dict, company_settings: Dict) -> BytesIO:
        """Generate Invoices Report PDF"""
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=40, leftMargin=40, topMargin=50, bottomMargin=50)
        
        elements = []
        width = A4[0] - 80
        
        # Header
        company_name = company_settings.get('company_name', 'Quick Wing Fleet Management')
        elements.append(Paragraph(company_name, self.styles['Title_Custom']))
        elements.append(Paragraph("Invoices Report", self.styles['Subtitle']))
        elements.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", self.styles['Normal']))
        elements.append(Spacer(1, 20))
        elements.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#1e3a5f')))
        elements.append(Spacer(1, 20))
        
        currency = company_settings.get('currency_symbol', '€')
        
        # Summary Section
        elements.append(Paragraph("Summary", self.styles['SectionHeader']))
        
        summary_data = [
            ['Total Invoices', str(data.get('total_count', 0))],
            ['Grand Total', f"{currency}{data.get('grand_total', 0):.2f}"],
        ]
        
        by_status = data.get('by_status', {})
        for status, info in by_status.items():
            summary_data.append([
                f"{status.capitalize()} ({info.get('count', 0)})",
                f"{currency}{info.get('amount', 0):.2f}"
            ])
        
        summary_table = Table(summary_data, colWidths=[width*0.6, width*0.4])
        summary_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, 1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LINEBELOW', (0, 1), (-1, 1), 1, colors.HexColor('#dddddd')),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 30))
        
        # Invoices List
        elements.append(Paragraph("Invoice Details", self.styles['SectionHeader']))
        
        invoices = data.get('invoices', [])
        if invoices:
            table_data = [['Invoice #', 'Franchise', 'Amount', 'Status', 'Due Date']]
            
            for inv in invoices:
                due_date = inv.get('due_date', '')[:10] if inv.get('due_date') else 'N/A'
                table_data.append([
                    inv.get('invoice_number', 'N/A'),
                    inv.get('tenant_name', 'N/A')[:20],
                    f"{currency}{inv.get('total', 0):.2f}",
                    inv.get('status', 'N/A').upper(),
                    due_date
                ])
            
            col_widths = [width*0.2, width*0.3, width*0.18, width*0.15, width*0.17]
            invoices_table = Table(table_data, colWidths=col_widths)
            invoices_table.setStyle(self._get_header_table_style())
            invoices_table.setStyle(TableStyle([
                ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
            ]))
            elements.append(invoices_table)
        else:
            elements.append(Paragraph("No invoices found.", self.styles['Normal']))
        
        # Footer
        elements.append(Spacer(1, 40))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#dddddd')))
        elements.append(Spacer(1, 10))
        elements.append(Paragraph(f"Report generated by {company_name}", self.styles['Footer']))
        
        doc.build(elements)
        buffer.seek(0)
        return buffer


# Singleton instance
pdf_generator = PDFGenerator()
