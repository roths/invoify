import { NextRequest, NextResponse } from "next/server";

// Helpers
import { getInvoiceTemplate } from "@/lib/helpers";

// Variables
import { TAILWIND_CDN } from "@/lib/variables";

// Types
import { InvoiceType } from "@/types";

export async function generatePdfService(req: NextRequest) {
    const body: InvoiceType = await req.json();

    try {
        const ReactDOMServer = (await import("react-dom/server")).default;
        const templateId = body.details.pdfTemplate;
        const InvoiceTemplate = await getInvoiceTemplate(templateId);
        const htmlTemplate = ReactDOMServer.renderToStaticMarkup(
            InvoiceTemplate(body)
        );

        const accountId = process.env.CF_ACCOUNT_ID;
        const apiToken = process.env.CF_API_TOKEN;

        if (!accountId || !apiToken) {
            throw new Error("Missing CF_ACCOUNT_ID or CF_API_TOKEN environment variables");
        }

        const response = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/pdf`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    html: htmlTemplate,
                    addStyleTag: [{ url: TAILWIND_CDN }],
                    pdfOptions: {
                        format: "a4",
                        printBackground: true,
                        preferCSSPageSize: true,
                    },
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Browser Rendering API error ${response.status}: ${errorText}`);
        }

        const pdfBuffer = await response.arrayBuffer();

        return new NextResponse(pdfBuffer, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": "attachment; filename=invoice.pdf",
                "Cache-Control": "no-cache",
                Pragma: "no-cache",
            },
            status: 200,
        });
    } catch (error: any) {
        console.error("PDF Generation Error:", error);
        return new NextResponse(
            JSON.stringify({ error: "Failed to generate PDF" }),
            {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );
    }
}
