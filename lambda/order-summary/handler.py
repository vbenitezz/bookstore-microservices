import json
import os
import pg8000.native

def lambda_handler(event, context):
    params = event.get('queryStringParameters') or {}
    days   = int(params.get('days', 30))

    try:
        conn = pg8000.native.Connection(
            host     = os.environ['DB_HOST'],
            port     = int(os.environ.get('DB_PORT', 5432)),
            database = os.environ['DB_NAME'],
            user     = os.environ['DB_USER'],
            password = os.environ['DB_PASSWORD'],
            ssl_context = True
        )

        conn.run("SET search_path TO orders, public")

        # Summary
        row = conn.run("""
            SELECT COUNT(*)::int, COALESCE(SUM(total),0)::float,
                   COALESCE(AVG(total),0)::float
            FROM orders.orders
            WHERE created_at >= NOW() - INTERVAL ':days days'
        """, days=days)
        # pg8000 no interpola INTERVAL así, usar formato directo
        row = conn.run(f"""
            SELECT COUNT(*)::int, COALESCE(SUM(total),0)::float,
                   COALESCE(AVG(total),0)::float
            FROM orders.orders
            WHERE created_at >= NOW() - INTERVAL '{days} days'
        """)
        summary = {'total_orders': row[0][0], 'total_revenue': row[0][1], 'avg_order_value': row[0][2]}

        # By status
        rows = conn.run(f"""
            SELECT status, COUNT(*)::int, COALESCE(SUM(total),0)::float
            FROM orders.orders
            WHERE created_at >= NOW() - INTERVAL '{days} days'
            GROUP BY status ORDER BY 2 DESC
        """)
        by_status = [{'status': r[0], 'count': r[1], 'revenue': r[2]} for r in rows]

        # Recent orders
        rows = conn.run("""
            SELECT id::text, status, total::float, shipping_name,
                   shipping_email, created_at::text
            FROM orders.orders ORDER BY created_at DESC LIMIT 10
        """)
        recent = [{'id':r[0],'status':r[1],'total':r[2],
                   'shipping_name':r[3],'shipping_email':r[4],'created_at':r[5]} for r in rows]

        # Daily revenue last 7 days
        rows = conn.run("""
            SELECT DATE(created_at)::text, COUNT(*)::int,
                   COALESCE(SUM(total),0)::float
            FROM orders.orders
            WHERE created_at >= NOW() - INTERVAL '7 days'
            GROUP BY DATE(created_at) ORDER BY 1 DESC
        """)
        daily = [{'day': r[0], 'orders': r[1], 'revenue': r[2]} for r in rows]

        conn.close()

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'period_days':   days,
                'summary':       summary,
                'by_status':     by_status,
                'recent_orders': recent,
                'daily_revenue': daily
            }, default=str)
        }

    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': str(e)})
        }