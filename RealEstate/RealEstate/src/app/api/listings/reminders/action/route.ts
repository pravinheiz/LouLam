import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import crypto from "crypto";

function renderHtmlResponse(title: string, message: string, isError = false) {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>LouLam Marketplace — Status Action</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: #0f172a;
            color: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
          }
          .card {
            background-color: #1e293b;
            border: 1px solid #334155;
            border-radius: 24px;
            padding: 40px;
            text-align: center;
            max-width: 480px;
            width: 100%;
            box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.3), 0 8px 10px -6px rgb(0 0 0 / 0.3);
          }
          .logo {
            font-size: 28px;
            font-weight: 800;
            color: #6366f1;
            margin-bottom: 24px;
            letter-spacing: -0.025em;
          }
          .icon {
            width: 64px;
            height: 64px;
            margin: 0 auto 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            font-size: 32px;
          }
          .icon.success {
            background-color: #10b98120;
            color: #10b981;
            border: 2px solid #10b98140;
          }
          .icon.error {
            background-color: #ef444420;
            color: #ef4444;
            border: 2px solid #ef444440;
          }
          h1 {
            font-size: 22px;
            font-weight: 700;
            margin-bottom: 12px;
            color: #ffffff;
          }
          p {
            color: #94a3b8;
            font-size: 15px;
            line-height: 1.6;
            margin-bottom: 32px;
          }
          .btn {
            display: inline-block;
            background-color: #6366f1;
            color: #ffffff;
            text-decoration: none;
            font-weight: 600;
            font-size: 14px;
            padding: 12px 28px;
            border-radius: 12px;
            transition: all 0.2s;
          }
          .btn:hover {
            background-color: #4f46e5;
            transform: translateY(-1px);
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="logo">LouLam</div>
          <div class="icon ${isError ? 'error' : 'success'}">
            ${isError ? '✕' : '✓'}
          </div>
          <h1>${title}</h1>
          <p>${message}</p>
          <a href="${baseUrl}" class="btn">Go to Marketplace</a>
        </div>
      </body>
    </html>
  `;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const action = searchParams.get("action");
    const token = searchParams.get("token");

    if (!id || !action || !token) {
      return new NextResponse(
        renderHtmlResponse(
          "Invalid Request",
          "One or more required parameters (id, action, token) are missing from the URL.",
          true
        ),
        { headers: { "Content-Type": "text/html" } }
      );
    }

    // Fetch listing
    const property = await db.property.findUnique({ where: { id } });
    if (!property || property.deletedAt) {
      return new NextResponse(
        renderHtmlResponse(
          "Listing Not Found",
          "The property listing you are trying to manage could not be found or has already been deleted.",
          true
        ),
        { headers: { "Content-Type": "text/html" } }
      );
    }

    // Validate security token
    const expectedToken = crypto
      .createHmac("sha256", process.env.NEXTAUTH_SECRET || "secret")
      .update(`${id}:${property.ownerId}`)
      .digest("hex");

    if (token !== expectedToken) {
      return new NextResponse(
        renderHtmlResponse(
          "Access Denied",
          "The security code for this listing action is invalid or has expired.",
          true
        ),
        { headers: { "Content-Type": "text/html" } }
      );
    }

    let successMessage = "";

    // Perform action
    if (action === "sold") {
      await db.property.update({
        where: { id },
        data: { status: "SOLD" },
      });
      successMessage = `The property "${property.title}" has been successfully marked as Sold.`;
    } else if (action === "keep") {
      await db.property.update({
        where: { id },
        data: {
          createdAt: new Date().toISOString(),
          lastReminderSentAt: null,
        },
      });
      successMessage = `The property listing "${property.title}" has been renewed and remains Active.`;
    } else if (action === "remove") {
      await db.property.update({
        where: { id },
        data: { deletedAt: new Date().toISOString() },
      });
      successMessage = `The property listing "${property.title}" has been successfully removed from the marketplace.`;
    } else {
      return new NextResponse(
        renderHtmlResponse(
          "Invalid Action",
          `Action "${action}" is not recognized. Must be 'sold', 'keep', or 'remove'.`,
          true
        ),
        { headers: { "Content-Type": "text/html" } }
      );
    }

    return new NextResponse(
      renderHtmlResponse("Action Successful!", successMessage, false),
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (error: any) {
    console.error("Error handling direct listing action:", error);
    return new NextResponse(
      renderHtmlResponse(
        "Server Error",
        "An unexpected error occurred while processing your request. Please try again later.",
        true
      ),
      { headers: { "Content-Type": "text/html" } }
    );
  }
}
