/*
MIT License

Copyright (c) 2019 - 2022 Lilly Rose Berner

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import { Environment, HTTPError } from "../..";

function validateCustomId(id: string): boolean {
  // Check length
  if (id.length > 50) {
    return false;
  }
  
  // Check valid characters (letters, numbers, hyphens)
  if (!/^[a-zA-Z0-9-]+$/.test(id)) {
    return false;
  }
  
  // Check not starting or ending with hyphen
  if (id.startsWith('-') || id.endsWith('-')) {
    return false;
  }
  
  return true;
}

export const onRequestGet: PagesFunction<Environment> = async ({ params, env }) => {
  const content = await env.STORAGE.get(`documents:${params.id}`);

  if (content) {
    const json = { key: params.id, data: content };
    const headers = {
      "Content-Type": "application/json; charset=UTF-8",
    };

    const data = JSON.stringify(json);
    return new Response(data, { headers, status: 200 });
  }

  throw new HTTPError(404, `Document "${params.id}" not found.`);
};

export const onRequestPut: PagesFunction<Environment> = async ({ params, request, env }) => {
  const customId = params.id as string;
  
  // Validate custom ID
  if (!validateCustomId(customId)) {
    throw new HTTPError(400, "Invalid document ID. ID must contain only letters, numbers, and hyphens, cannot start or end with hyphens, and must be 1-50 characters long.");
  }
  
  const length = Number(request.headers.get("Content-Length") || 0);

  if (!length) {
    throw new HTTPError(400, "Content must contain at least one character.");
  }

  if (length > env.MAX_DOCUMENT_SIZE) {
    throw new HTTPError(400, `Content must be shorter than ${env.MAX_DOCUMENT_SIZE} characters (was ${length}).`);
  }

  // Check if document already exists
  const existingContent = await env.STORAGE.get(`documents:${customId}`);
  if (existingContent) {
    throw new HTTPError(409, `Document with ID "${customId}" already exists.`);
  }

  const content = await request.text();
  
  await env.STORAGE.put(`documents:${customId}`, content, { expirationTtl: env.DOCUMENT_EXPIRE_TTL });

  const domain = new URL(request.url).hostname;

  const json = {
    key: customId,
    url: `https://${domain}/${customId}`,
  };
  const headers = {
    "Content-Type": "application/json; charset=UTF-8",
  };

  const data = JSON.stringify(json);
  return new Response(data, { headers, status: 200 });
};
