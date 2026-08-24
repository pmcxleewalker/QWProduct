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

    def generate_tenant_reports_pdf(self, data: Dict, tenant_name: str) -> BytesIO:
        """Generate a PDF report for tenant-specific analytics"""
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
        width = A4[0] - 100
        
        # Header
        elements.append(Paragraph(f"{tenant_name}", self.styles['Title_Custom']))
        elements.append(Paragraph("Franchise Analytics Report", self.styles['Subtitle']))
        elements.append(Paragraph(f"Generated: {datetime.now().strftime('%d %B %Y, %H:%M')}", self.styles['Normal']))
        elements.append(Spacer(1, 20))
        elements.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#1e3a5f')))
        elements.append(Spacer(1, 20))
        
        summary = data.get('summary', {})
        
        # Key Metrics Section
        elements.append(Paragraph("Key Metrics", self.styles['SectionHeader']))
        
        metrics_data = [
            ['Metric', 'Value'],
            ['Total Vehicles', str(summary.get('total_vehicles', 0))],
            ['Total Bookings', str(summary.get('total_bookings', 0))],
            ['Bookings This Month', str(summary.get('bookings_this_month', 0))],
            ['Bookings Last Month', str(summary.get('bookings_last_month', 0))],
            ['Booking Trend', f"{summary.get('booking_trend_percent', 0)}%"],
            ['Vehicles Used This Month', str(summary.get('vehicles_used_this_month', 0))],
            ['Fleet Utilization', f"{summary.get('utilization_rate_percent', 0)}%"],
            ['Team Members', str(summary.get('team_members', 0))],
        ]
        
        metrics_table = Table(metrics_data, colWidths=[width * 0.6, width * 0.4])
        metrics_table.setStyle(self._get_header_table_style())
        metrics_table.setStyle(TableStyle([
            ('ALIGN', (1, 0), (1, -1), 'CENTER'),
        ]))
        elements.append(metrics_table)
        elements.append(Spacer(1, 30))
        
        # Vehicle Usage Section
        elements.append(Paragraph("Vehicle Usage (Top 10)", self.styles['SectionHeader']))
        
        vehicle_usage = data.get('vehicle_usage', [])
        if vehicle_usage:
            vehicle_data = [['Rank', 'Vehicle', 'Registration', 'Bookings', 'Status']]
            for i, vehicle in enumerate(vehicle_usage[:10], 1):
                status = 'Blocked' if vehicle.get('is_blocked') else 'Available'
                vehicle_data.append([
                    str(i),
                    vehicle.get('name', 'N/A'),
                    vehicle.get('registration', 'N/A'),
                    str(vehicle.get('total_bookings', 0)),
                    status
                ])
            
            col_widths = [width * 0.08, width * 0.32, width * 0.22, width * 0.18, width * 0.2]
            vehicle_table = Table(vehicle_data, colWidths=col_widths)
            vehicle_table.setStyle(self._get_header_table_style())
            vehicle_table.setStyle(TableStyle([
                ('ALIGN', (0, 0), (0, -1), 'CENTER'),
                ('ALIGN', (3, 0), (3, -1), 'CENTER'),
            ]))
            elements.append(vehicle_table)
        else:
            elements.append(Paragraph("No vehicle usage data available.", self.styles['Normal']))
        
        elements.append(Spacer(1, 30))
        
        # Daily Booking Trend Section
        elements.append(Paragraph("Bookings This Week", self.styles['SectionHeader']))
        
        daily_trend = data.get('daily_booking_trend', [])
        if daily_trend:
            trend_data = [['Date', 'Day', 'Bookings']]
            for day in daily_trend:
                date_str = day.get('date', '')
                try:
                    date_obj = datetime.strptime(date_str, '%Y-%m-%d')
                    day_name = date_obj.strftime('%A')
                    formatted_date = date_obj.strftime('%d %b')
                except:
                    day_name = 'N/A'
                    formatted_date = date_str
                
                trend_data.append([
                    formatted_date,
                    day_name,
                    str(day.get('count', 0))
                ])
            
            trend_table = Table(trend_data, colWidths=[width * 0.3, width * 0.4, width * 0.3])
            trend_table.setStyle(self._get_header_table_style())
            trend_table.setStyle(TableStyle([
                ('ALIGN', (2, 0), (2, -1), 'CENTER'),
            ]))
            elements.append(trend_table)
        else:
            elements.append(Paragraph("No daily booking data available.", self.styles['Normal']))
        
        # Footer
        elements.append(Spacer(1, 40))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#dddddd')))
        elements.append(Spacer(1, 10))
        elements.append(Paragraph(f"Report generated by Quick Wing Fleet Management", self.styles['Footer']))
        
        doc.build(elements)
        buffer.seek(0)
        return buffer

    def generate_audit_log_pdf(self, audit_events: List[Dict], settings: Dict, 
                                filter_name: str = "All Activity", tenant_name: str = None) -> BytesIO:
        """Generate Audit Log PDF with company branding"""
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=40, rightMargin=40, topMargin=40, bottomMargin=40)
        elements = []
        
        company_name = settings.get('company_name', 'Quick Wing Fleet Management')
        
        # Header with company branding
        header_data = [
            [Paragraph(f"<b>{company_name}</b>", self.styles['Title_Custom'])],
            [Paragraph("Audit Log Report", self.styles['Subtitle'])]
        ]
        header_table = Table(header_data, colWidths=[500])
        header_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        elements.append(header_table)
        
        # Logo placeholder line
        elements.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#1e3a5f')))
        elements.append(Spacer(1, 20))
        
        # Report info
        report_title = tenant_name if tenant_name else filter_name
        info_data = [
            ['Report Type:', f"Audit Log - {report_title}"],
            ['Generated:', datetime.now().strftime('%B %d, %Y at %H:%M')],
            ['Total Events:', str(len(audit_events))],
        ]
        info_table = Table(info_data, colWidths=[120, 380])
        info_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#666666')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        elements.append(info_table)
        elements.append(Spacer(1, 20))
        
        # Audit events table
        elements.append(Paragraph("Audit Events", self.styles['SectionHeader']))
        
        if audit_events:
            table_data = [['Timestamp', 'Actor', 'Action', 'Resource', 'Details']]
            
            for event in audit_events:
                timestamp = event.get('created_at', '')
                if timestamp:
                    try:
                        dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                        timestamp = dt.strftime('%Y-%m-%d %H:%M')
                    except:
                        pass
                
                actor = event.get('actor_email', 'System')[:25]
                action = event.get('action', '-')
                resource = event.get('resource_type', '-')
                meta = event.get('meta', {})
                details = str(meta)[:40] + '...' if meta and len(str(meta)) > 40 else str(meta) if meta else '-'
                
                table_data.append([timestamp, actor, action, resource, details])
            
            # Limit rows for readability
            if len(table_data) > 51:
                table_data = table_data[:51]
                table_data.append(['...', f'And {len(audit_events) - 50} more events', '', '', ''])
            
            table = Table(table_data, colWidths=[85, 100, 90, 80, 145])
            table.setStyle(self._get_header_table_style())
            table.setStyle(TableStyle([
                ('FONTSIZE', (0, 1), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dddddd')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')]),
            ]))
            elements.append(table)
        else:
            elements.append(Paragraph("No audit events found for this filter.", self.styles['Normal']))
        
        # Footer with branding
        elements.append(Spacer(1, 40))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#dddddd')))
        elements.append(Spacer(1, 10))
        elements.append(Paragraph(
            f"Audit Log Report • {company_name} • Generated on {datetime.now().strftime('%B %d, %Y')}",
            self.styles['Footer']
        ))
        
        doc.build(elements)
        buffer.seek(0)
        return buffer
    def generate_compliance_pack_pdf(self, tenant_name: str, company_settings: Dict,
                                     generated_by: str, period_label: str,
                                     compliance_rows: List[Dict], compliance_summary: Dict,
                                     bookings: List[Dict], total_bookings: int) -> BytesIO:
        """Generate an auditor-ready Fleet Compliance & Usage pack for a tenant."""
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=40, rightMargin=40,
                                topMargin=48, bottomMargin=48)
        elements = []
        width = A4[0] - 80

        status_color = {
            'VALID': colors.HexColor('#16a34a'),
            'EXPIRING': colors.HexColor('#b45309'),
            'EXPIRED': colors.HexColor('#dc2626'),
            'N/A': colors.HexColor('#94a3b8'),
        }

        # ---------- Cover ----------
        elements.append(Paragraph(tenant_name or 'Fleet', self.styles['Title_Custom']))
        elements.append(Paragraph('Fleet Compliance &amp; Usage — Audit Pack', self.styles['Subtitle']))

        # Company / contact block from settings
        contact_bits = []
        for key, prefix in [('address_line1', ''), ('city', ''), ('postal_code', ''),
                            ('phone', 'Phone: '), ('email', 'Email: '), ('tax_id', 'VAT: ')]:
            val = company_settings.get(key)
            if val:
                contact_bits.append(f"{prefix}{val}")
        if contact_bits:
            elements.append(Paragraph(' &nbsp;•&nbsp; '.join(contact_bits), self.styles['Normal']))

        info_data = [
            ['Reporting period:', period_label],
            ['Generated on:', datetime.now().strftime('%d %B %Y at %H:%M')],
            ['Generated by:', generated_by or 'Fleet Administrator'],
            ['Fleet size:', f"{compliance_summary.get('vehicles', 0)} vehicles"],
        ]
        info_table = Table(info_data, colWidths=[130, width - 130])
        info_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#475569')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(Spacer(1, 14))
        elements.append(info_table)
        elements.append(Spacer(1, 14))
        elements.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#1e3a5f')))
        elements.append(Spacer(1, 18))

        # ---------- Section 1: Compliance summary ----------
        elements.append(Paragraph("1. Vehicle Compliance Register", self.styles['SectionHeader']))
        summary_line = (
            f"<b>{compliance_summary.get('valid', 0)}</b> valid &nbsp;•&nbsp; "
            f"<b>{compliance_summary.get('expiring', 0)}</b> expiring within 30 days &nbsp;•&nbsp; "
            f"<b>{compliance_summary.get('expired', 0)}</b> expired"
        )
        elements.append(Paragraph(summary_line, self.styles['Normal']))
        elements.append(Spacer(1, 10))

        header = ['Vehicle', 'Reg.', 'Tax', 'NCT', 'Insurance', 'Service', 'Status']
        table_data = [header]
        for r in compliance_rows:
            cells = r.get('cells', [])
            table_data.append([
                (r.get('name') or '—')[:22],
                r.get('registration') or '—',
                cells[0]['text'] if len(cells) > 0 else '—',
                cells[1]['text'] if len(cells) > 1 else '—',
                cells[2]['text'] if len(cells) > 2 else '—',
                cells[3]['text'] if len(cells) > 3 else '—',
                r.get('overall', 'N/A'),
            ])

        col_widths = [width*0.19, width*0.13, width*0.12, width*0.12, width*0.13, width*0.13, width*0.18]
        ctable = Table(table_data, colWidths=col_widths, repeatRows=1)
        style = [
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a5f')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8.5),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dddddd')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')]),
            ('ALIGN', (2, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('FONTNAME', (6, 1), (6, -1), 'Helvetica-Bold'),
        ]
        for i, r in enumerate(compliance_rows, start=1):
            cells = r.get('cells', [])
            for ci, cell in enumerate(cells[:4]):
                col = 2 + ci
                style.append(('TEXTCOLOR', (col, i), (col, i),
                              status_color.get(cell.get('status', 'N/A'), colors.black)))
            style.append(('TEXTCOLOR', (6, i), (6, i),
                          status_color.get(r.get('overall', 'N/A'), colors.black)))
        ctable.setStyle(TableStyle(style))
        elements.append(ctable)
        elements.append(Paragraph(
            "Status key: <font color='#16a34a'>VALID</font> (&gt;30 days) &nbsp; "
            "<font color='#b45309'>EXPIRING</font> (within 30 days) &nbsp; "
            "<font color='#dc2626'>EXPIRED</font> &nbsp; "
            "<font color='#94a3b8'>N/A</font> (not recorded)",
            self.styles['Footer']))
        elements.append(Spacer(1, 22))

        # ---------- Section 2: Booking / Usage Log ----------
        shown = len(bookings)
        title2 = f"2. Booking &amp; Usage Log — {period_label}"
        elements.append(Paragraph(title2, self.styles['SectionHeader']))
        note = f"{total_bookings} booking(s) in period."
        if total_bookings > shown:
            note += f" Showing the {shown} most recent."
        elements.append(Paragraph(note, self.styles['Normal']))
        elements.append(Spacer(1, 10))

        if bookings:
            blog = [['Date & Time', 'Vehicle', 'Driver / Booked by', 'Purpose', 'Location', 'Status']]
            for bk in bookings:
                blog.append([
                    bk.get('when', ''),
                    (bk.get('vehicle') or '—')[:24],
                    (bk.get('driver') or '—')[:18],
                    (bk.get('purpose') or '—')[:28],
                    (bk.get('location') or '—')[:18],
                    (bk.get('status') or '—').capitalize(),
                ])
            bwidths = [width*0.16, width*0.18, width*0.16, width*0.24, width*0.14, width*0.12]
            btable = Table(blog, colWidths=bwidths, repeatRows=1)
            btable.setStyle(self._get_header_table_style())
            btable.setStyle(TableStyle([
                ('FONTSIZE', (0, 1), (-1, -1), 7.5),
                ('FONTSIZE', (0, 0), (-1, 0), 8.5),
                ('TOPPADDING', (0, 1), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
            ]))
            elements.append(btable)
        else:
            elements.append(Paragraph("No bookings recorded in this period.", self.styles['Normal']))

        # ---------- Footer ----------
        company_name = company_settings.get('company_name', 'Quick Wing Fleet Management')
        elements.append(Spacer(1, 30))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#dddddd')))
        elements.append(Spacer(1, 8))
        elements.append(Paragraph(
            f"This document is a system-generated compliance record produced by {tenant_name} "
            f"using {company_name}. Generated {datetime.now().strftime('%d %B %Y')}.",
            self.styles['Footer']))

        doc.build(elements)
        buffer.seek(0)
        return buffer


# Singleton instance
pdf_generator = PDFGenerator()
