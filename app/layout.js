export const metadata = {
  title: 'DA LOGISTICS - Punto de Venta',
  description: 'Sistema POS offline y online conectado a Neon',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0" />
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}
