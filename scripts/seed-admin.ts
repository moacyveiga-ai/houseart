// Creates/updates the initial admin user.
//   Use: ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_NAME="..." ADMIN_CPF=... npx tsx scripts/seed-admin.ts
// Reads the .env (ADMIN_* of .env.example).
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'

async function main() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD || ''
  const name = process.env.ADMIN_NAME || 'Administrador'
  const cpf = (process.env.ADMIN_CPF || '').replace(/\D/g, '')
  if (!email || !password || !cpf) {
    console.error('ERRO: defina ADMIN_EMAIL, ADMIN_PASSWORD e ADMIN_CPF (só dígitos).')
    process.exit(1)
  }
  if (password.length < 8) {
    console.error('ERRO: a senha precisa ter ao menos 8 caracteres.')
    process.exit(1)
  }
  const passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, profile: 'admin', active: true, name },
    create: { email, cpf, name, passwordHash, profile: 'admin', active: true },
  })
  console.log(`✔ Admin pronto: ${user.email}`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
