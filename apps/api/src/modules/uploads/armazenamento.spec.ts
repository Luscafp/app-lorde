import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { criarClienteS3 } from './armazenamento'

describe('criarClienteS3 + presigner real (sem rede)', () => {
  it('assina content-type e content-length, expira em 300 s e não exige checksum', async () => {
    const s3 = criarClienteS3({
      R2_ACCOUNT_ID: '0123456789abcdef0123456789abcdef',
      R2_ACCESS_KEY_ID: 'chave',
      R2_SECRET_ACCESS_KEY: 'segredo',
    })
    const comando = new PutObjectCommand({
      Bucket: 'imagens',
      Key: 'usuarios/u/perfil/f.jpg',
      ContentType: 'image/jpeg',
      ContentLength: 800_000,
    })

    const url = new URL(
      await getSignedUrl(s3, comando, {
        expiresIn: 300,
        signableHeaders: new Set(['content-type', 'content-length']),
      }),
    )

    expect(url.host).toBe('0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com')
    expect(url.pathname).toBe('/imagens/usuarios/u/perfil/f.jpg')
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300')
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('content-length;content-type;host')
    expect([...url.searchParams.keys()].filter((p) => /checksum/i.test(p))).toEqual([])
  })
})
