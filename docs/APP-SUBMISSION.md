# App submission draft — do not submit until live acceptance testing is complete

This is a draft for the [official submission form](https://github.com/pollinations/pollinations/issues/new?template=app-submission.yml). Replace all placeholders and complete the real OAuth + generation checklist in `PUBLISHING.zh-CN.md` first.

## Issue title

[App Submission] Atelier — Image Studio

## App Name

Atelier — Image Studio

## App Description

Atelier is a bilingual image-creation workspace powered by Pollinations. Users sign in with Pollinations using the BYOP authorization-code flow with PKCE, approve spending from their own Pollen balance, and create images from prompts or edit them with reference images.

The app provides a live Pollinations image-model catalog, capability-aware reference editing, image downloads, and a private browser-local collection with favorites and search. English is the default language, with Simplified Chinese available in the interface.

Delegated user tokens stay in server memory behind an HttpOnly session cookie. They are never exposed to frontend JavaScript or stored in localStorage. The interface displays Pollinations attribution, budget and cost disclosures, privacy information, and links to manage or revoke authorization. This is an independent community app, not an official Pollinations product.

## App URL

https://image.xt1171.eu.org/

## GitHub Repository URL

https://github.com/xiaotian1171/atelier-image-studio

## App Category

image

## App Language

en

The description already notes that Simplified Chinese is also supported. The template asks for an ISO language code, so use the primary language code here.

## Discord Username

**OPTIONAL: your actual contact username, or leave blank.**

## Optional reviewer notes (use only after verifying these on the final deployment)

1. Click **Sign in** in the top-right corner, then **Sign in with Pollinations**.
2. Review and approve a small budget on the official consent page.
3. Choose an image model and enter a prompt; click **Start creating**. Requests spend the reviewing user's own approved Pollen, so keep the test budget small.
4. Open the result to download, favorite, or reuse it as a reference. For editing, choose a model that supports image input.
5. `/privacy` and `/terms` describe storage, costs, cancellation, and revocation.

Do not claim successful live testing, official acceptance, free unlimited access, or rewards unless those claims are independently true at submission time.
