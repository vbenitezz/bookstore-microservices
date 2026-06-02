import json
import os
import pg8000.native

def lambda_handler(event, context):
    params    = event.get('queryStringParameters') or {}
    q         = params.get('q', '').strip()
    category  = params.get('category', '').strip()
    min_price = params.get('min_price')
    max_price = params.get('max_price')
    limit     = min(int(params.get('limit', 20)), 100)

    try:
        conn = pg8000.native.Connection(
            host     = os.environ['DB_HOST'],
            port     = int(os.environ.get('DB_PORT', 5432)),
            database = os.environ['DB_NAME'],
            user     = os.environ['DB_USER'],
            password = os.environ['DB_PASSWORD'],
            ssl_context = True
        )

        conn.run("SET search_path TO catalog, public")

        conditions = ["b.is_active = TRUE"]
        params_sql = []

        if q:
            conditions.append("(b.title ILIKE :q1 OR b.author ILIKE :q2)")
            params_sql.append(('q1', f'%{q}%'))
            params_sql.append(('q2', f'%{q}%'))

        if category:
            conditions.append("c.slug = :category")
            params_sql.append(('category', category))

        if min_price:
            conditions.append("b.price >= :min_price")
            params_sql.append(('min_price', float(min_price)))

        if max_price:
            conditions.append("b.price <= :max_price")
            params_sql.append(('max_price', float(max_price)))

        where     = " AND ".join(conditions)
        sql_params = dict(params_sql)
        sql_params['limit'] = limit

        rows = conn.run(f"""
            SELECT b.id::text, b.title, b.author, b.isbn,
                   b.price::float, b.stock, b.cover_url, b.language,
                   c.name AS category_name, c.slug AS category_slug
            FROM catalog.books b
            LEFT JOIN catalog.categories c ON b.category_id = c.id
            WHERE {where}
            ORDER BY b.title
            LIMIT :limit
        """, **sql_params)

        columns = ['id','title','author','isbn','price','stock',
                   'cover_url','language','category_name','category_slug']
        books = [dict(zip(columns, row)) for row in rows]
        conn.close()

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'results': books,
                'count':   len(books),
                'query':   q or None
            }, default=str)
        }

    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': str(e)})
        }