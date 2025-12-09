export async function onRequest(context) {
  // A MESMA SENHA QUE ESTÁ NO SEU ARQUIVO ELECTRON.JS
  // Isso garante que o programa aceite a chave gerada pelo site.
  const SECRET_KEY = "POKER_PILOT_MANAGER_MASTER_KEY_V2_SECURE";

  // Configuração de CORS para permitir que o MAKE (Integromat) acesse
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // Se for uma verificação de pré-voo (OPTIONS), responde ok
  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(context.request.url);
    const daysParam = url.searchParams.get("days");
    
    // Se não especificar dias na URL, gera para 365 dias (Vitalício padrão)
    const daysValid = daysParam ? parseInt(daysParam) : 365;
    const type = daysValid > 360 ? 'LIFETIME' : 'MONTHLY';

    // 1. Calcular Timestamp de expiração
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysValid);
    const expiryTimestamp = expiryDate.getTime();

    // 2. Montar os dados para assinar
    const prefix = 'PPMV2';
    const dataToSign = `${prefix}|${expiryTimestamp}|${type}`;

    // 3. Criptografia compatível com Cloudflare (Web Crypto API)
    // O Cloudflare não usa a biblioteca 'crypto' antiga do Node.js, usa esta moderna:
    const encoder = new TextEncoder();
    const keyData = encoder.encode(SECRET_KEY);
    const messageData = encoder.encode(dataToSign);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      messageData
    );

    // Converter a assinatura para HEX e pegar os primeiros 16 caracteres maiúsculos
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const signatureHex = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const finalSignature = signatureHex.substring(0, 16).toUpperCase();

    // 4. Montar a Chave Final
    const finalKey = `${dataToSign}|${finalSignature}`;

    // Retorna a resposta (JSON) para o Make
    return new Response(JSON.stringify({
      success: true,
      key: finalKey,
      valid_until: expiryDate.toLocaleString('pt-BR')
    }), {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }
}