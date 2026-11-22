'use strict';

const {
    randomBytes,
    scrypt,
    timingSafeEqual,
    createHash
} = require('node:crypto');

const { promisify } = require('node:util');

const scryptAsync = promisify(scrypt);

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

// Criar hash seguro da palavra-passe
async function hashPassword(password) {
    if (
        typeof password !== 'string' ||
        Buffer.byteLength(password, 'utf8') < 8 ||
        Buffer.byteLength(password, 'utf8') > 128
    ) {
        throw new Error('Palavra-passe inválida');
    }

    const salt = randomBytes(SALT_LENGTH);

    const derivedKey = await scryptAsync(
        password,
        salt,
        KEY_LENGTH
    );

    return [
        'scrypt',
        salt.toString('hex'),
        derivedKey.toString('hex')
    ].join('$');
}

// Verificar palavra-passe
async function verifyPassword(password, storedHash) {
    if (
        typeof password !== 'string' ||
        Buffer.byteLength(password, 'utf8') < 8 ||
        Buffer.byteLength(password, 'utf8') > 128 ||
        typeof storedHash !== 'string'
    ) {
        return false;
    }

    const parts = storedHash.split('$');

    if (parts.length !== 3 || parts[0] !== 'scrypt') {
        return false;
    }

    const [, saltHex, keyHex] = parts;

    if (
        !/^[a-f0-9]{32}$/i.test(saltHex) ||
        !/^[a-f0-9]{128}$/i.test(keyHex)
    ) {
        return false;
    }

    const salt = Buffer.from(saltHex, 'hex');
    const originalKey = Buffer.from(keyHex, 'hex');

    const derivedKey = await scryptAsync(
        password,
        salt,
        KEY_LENGTH
    );

    return timingSafeEqual(originalKey, derivedKey);
}

// Gerar token de sessão
function generateSessionToken() {
    return randomBytes(32).toString('hex');
}

// Armazenar apenas o hash do token
function hashSessionToken(token) {
    return createHash('sha256')
        .update(token)
        .digest('hex');
}

module.exports = {
    hashPassword,
    verifyPassword,
    generateSessionToken,
    hashSessionToken
};
