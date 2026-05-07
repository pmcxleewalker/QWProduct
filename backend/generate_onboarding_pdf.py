"""
Generates a polished onboarding PDF for a new Quick Wing tenant.

Usage:
    python generate_onboarding_pdf.py <tenant_name> <tenant_slug> <admin_name> <admin_email>

Example:
    python generate_onboarding_pdf.py "Bluebird" "bluebird" "Mary Smith" "mary@bluebird.ie"

Outputs:
    /app/frontend/public/docs/<slug>-onboarding.pdf
"""
import sys
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
)


SLATE_900 = colors.HexColor("#0f172a")
SLATE_700 = colors.HexColor("#334155")
SLATE_500 = colors.HexColor("#64748b")
SLATE_200 = colors.HexColor("#e2e8f0")
SLATE_50  = colors.HexColor("#f8fafc")
BLUE_600  = colors.HexColor("#2563eb")
BLUE_50   = colors.HexColor("#eff6ff")
EMERALD_600 = colors.HexColor("#059669")


def build_pdf(tenant_name, tenant_slug, admin_name, admin_email, out_path):
    doc = SimpleDocTemplate(
        out_path, pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=2*cm, bottomMargin=2*cm,
        title=f"{tenant_name} — Quick Wing Onboarding",
        author="QuickFleet Limited",
    )

    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("H1", parent=styles["Heading1"],
                       fontName="Helvetica-Bold", fontSize=22, leading=26,
                       textColor=SLATE_900, spaceAfter=4)
    h2 = ParagraphStyle("H2", parent=styles["Heading2"],
                       fontName="Helvetica-Bold", fontSize=13, leading=16,
                       textColor=SLATE_900, spaceBefore=14, spaceAfter=6)
    body = ParagraphStyle("Body", parent=styles["BodyText"],
                          fontName="Helvetica", fontSize=10, leading=14,
                          textColor=SLATE_700)
    sub = ParagraphStyle("Sub", parent=body, fontSize=9,
                         textColor=SLATE_500, leading=12)
    pill = ParagraphStyle("Pill", parent=body, fontSize=8,
                          textColor=BLUE_600, leading=10)
    foot = ParagraphStyle("Foot", parent=body, fontSize=8,
                          textColor=SLATE_500, leading=10, alignment=1)
    code = ParagraphStyle("Code", parent=body, fontName="Courier",
                          fontSize=10, textColor=SLATE_900,
                          backColor=SLATE_50, borderPadding=4)

    story = []

    # ===== Hero =====
    story.append(Paragraph('<font color="#2563eb">QUICK WING · ONBOARDING</font>', pill))
    story.append(Spacer(1, 4))
    story.append(Paragraph(f"Welcome to Quick Wing, {tenant_name}.", h1))
    story.append(Paragraph(
        f"Hi {admin_name}, your Quick Wing workspace for <b>{tenant_name}</b> is ready. "
        "This guide walks you through the 10-minute setup so your team can start booking, "
        "logging incidents and tracking fuel from day one.",
        body
    ))
    story.append(Spacer(1, 14))

    # ===== Login card =====
    login_url = f"https://quick-wing.com/{tenant_slug}/login"
    login_card = Table([
        [Paragraph("<b>Your login URL</b>", body)],
        [Paragraph(f'<font color="#2563eb">{login_url}</font>', code)],
        [Paragraph("<b>Master admin email</b>", body)],
        [Paragraph(admin_email, code)],
        [Paragraph("<b>Temporary password</b>", body)],
        [Paragraph("Sent in a separate email titled <b>“Welcome to Quick Wing”</b>. "
                   "You'll be asked to set your own password on first sign-in.", sub)],
    ], colWidths=[16*cm])
    login_card.setStyle(TableStyle([
        ("BOX", (0,0), (-1,-1), 1, SLATE_200),
        ("BACKGROUND", (0,0), (-1,-1), colors.white),
        ("LEFTPADDING",  (0,0), (-1,-1), 14),
        ("RIGHTPADDING", (0,0), (-1,-1), 14),
        ("TOPPADDING",   (0,0), (-1,-1), 6),
        ("BOTTOMPADDING",(0,0), (-1,-1), 6),
        ("LINEABOVE", (0,0), (-1,0), 4, BLUE_600),
    ]))
    story.append(login_card)
    story.append(Spacer(1, 14))

    # ===== Quick start =====
    story.append(Paragraph("Quick start in 5 steps", h2))
    steps = [
        ("1", "Sign in",
         f"Open <b>{login_url}</b> and sign in with the temp password we sent. "
         "You'll be asked to set your own password."),
        ("2", "Check your fleet settings",
         "Go to <b>Settings</b> and confirm working hours, locations, mileage rate, "
         "and compliance reminders (NCT, DOE, insurance, tax)."),
        ("3", "Bulk-import your vehicles",
         "Open <b>Fleet → All Cars → Bulk Import</b>. Download the CSV template, "
         "fill in registration / make / model / year / NCT / insurance / tax expiry, "
         "drop it in. All vehicles created in seconds."),
        ("4", "Bulk-import your staff",
         "Open <b>Team → Bulk Import</b>. CSV columns: name, email, role. "
         "Each staff member gets a branded invitation email with a one-click "
         "activation link. Default temp password: <b>QuickWing123!</b>"),
        ("5", "Start operating",
         "Admins use the desktop dashboard for compliance, bookings and reports. "
         "Staff use the mobile app at the same URL — no install needed."),
    ]
    for num, title, text in steps:
        row = Table([[
            Paragraph(f'<font color="white"><b>{num}</b></font>', body),
            Paragraph(f"<b>{title}</b><br/>{text}", body),
        ]], colWidths=[1*cm, 15*cm])
        row.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (0,0), BLUE_600),
            ("VALIGN", (0,0), (-1,-1), "TOP"),
            ("ALIGN", (0,0), (0,0), "CENTER"),
            ("LEFTPADDING",  (0,0), (-1,-1), 8),
            ("RIGHTPADDING", (0,0), (-1,-1), 8),
            ("TOPPADDING",   (0,0), (-1,-1), 6),
            ("BOTTOMPADDING",(0,0), (-1,-1), 6),
            ("BOX", (1,0), (1,0), 0.5, SLATE_200),
        ]))
        story.append(row)
        story.append(Spacer(1, 6))

    story.append(PageBreak())

    # ===== Page 2: features overview =====
    story.append(Paragraph('<font color="#2563eb">WHAT YOU GET</font>', pill))
    story.append(Spacer(1, 4))
    story.append(Paragraph("Everything your fleet needs, in one place.", h1))
    story.append(Spacer(1, 10))

    feature_rows = [
        ("Smart bookings",
         "Drag-and-drop calendar. Conflict detection. Lift requests for staff without bookings."),
        ("Compliance tracking",
         "Never miss an NCT, DOE, insurance or tax renewal. Email + dashboard alerts."),
        ("Incident reports",
         "Staff log accidents, breakdowns and damage with up to 5 photos. "
         "Admins export PDFs with embedded images for insurers."),
        ("Fuel Log",
         "Built-in form for staff to log fill-ups. Admins see total spend, litres and "
         "fills per vehicle on the Documents dashboard."),
        ("Custom Documents",
         "Build your own forms (pre-trip checks, mileage logs, anything) and have staff "
         "submit them from their phones."),
        ("Bulk CSV imports",
         "Onboard your whole fleet and team in minutes, not hours."),
        ("Reports & PDFs",
         "Fleet utilisation, cost analytics, monthly summaries. Export-ready for "
         "your accountant."),
        ("Mobile-first staff app",
         "No install — staff just open the URL on their phone. Add to home screen for "
         "an app-like experience."),
    ]
    for title, desc in feature_rows:
        bullet = Table([[
            Paragraph('<font color="#059669"><b>✓</b></font>', body),
            Paragraph(f"<b>{title}</b> — {desc}", body),
        ]], colWidths=[0.7*cm, 15.3*cm])
        bullet.setStyle(TableStyle([
            ("VALIGN", (0,0), (-1,-1), "TOP"),
            ("LEFTPADDING",  (0,0), (-1,-1), 0),
            ("RIGHTPADDING", (0,0), (-1,-1), 0),
            ("TOPPADDING",   (0,0), (-1,-1), 4),
            ("BOTTOMPADDING",(0,0), (-1,-1), 4),
        ]))
        story.append(bullet)

    story.append(Spacer(1, 14))

    # ===== Support =====
    story.append(Paragraph("Need a hand?", h2))
    support_card = Table([
        [Paragraph("<b>Email support</b><br/>"
                   '<font color="#2563eb">Lee.quickwing@gmail.com</font>', body),
         Paragraph("<b>Reply to any Quick Wing email</b><br/>"
                   "Replies route straight to support — no need for a different inbox.", body)],
    ], colWidths=[8*cm, 8*cm])
    support_card.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), BLUE_50),
        ("BOX", (0,0), (-1,-1), 0.5, SLATE_200),
        ("LEFTPADDING",  (0,0), (-1,-1), 12),
        ("RIGHTPADDING", (0,0), (-1,-1), 12),
        ("TOPPADDING",   (0,0), (-1,-1), 10),
        ("BOTTOMPADDING",(0,0), (-1,-1), 10),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
    ]))
    story.append(support_card)

    story.append(Spacer(1, 16))

    # ===== Footer =====
    story.append(Paragraph(
        "© 2026 QuickFleet Limited. Quick Wing is a product of QuickFleet Limited. "
        "All rights reserved.", foot
    ))

    doc.build(story)
    print(f"Generated: {out_path}")


if __name__ == "__main__":
    if len(sys.argv) >= 5:
        tenant_name, tenant_slug, admin_name, admin_email = sys.argv[1:5]
    else:
        tenant_name = "Bluebird"
        tenant_slug = "bluebird"
        admin_name = "Bluebird Admin"
        admin_email = "admin@bluebird.example"

    out_dir = "/app/frontend/public/docs"
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"{tenant_slug}-onboarding.pdf")
    build_pdf(tenant_name, tenant_slug, admin_name, admin_email, out_path)
