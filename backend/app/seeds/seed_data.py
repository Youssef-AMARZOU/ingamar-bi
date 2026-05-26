import pandas as pd
import numpy as np
from sqlalchemy import inspect as sa_inspect
from app import db


def seed_if_empty():
    inspector = sa_inspect(db.engine)
    tables = inspector.get_table_names()
    if 'retail_sample' in tables:
        return

    np.random.seed(42)
    n = 500

    df = pd.DataFrame({
        'date': pd.date_range('2023-01-01', periods=n, freq='D'),
        'category': np.random.choice(['Electronics', 'Clothing', 'Food', 'Sports', 'Books'], n),
        'region': np.random.choice(['North', 'South', 'East', 'West'], n),
        'sales': np.random.randint(500, 50000, n),
        'quantity': np.random.randint(1, 100, n),
        'profit': np.random.randint(50, 5000, n),
        'customer_age': np.random.randint(18, 70, n),
    })

    df.loc[50, 'sales'] = 250000
    df.loc[150, 'sales'] = 10
    df.loc[300, 'sales'] = 180000

    df.to_sql('retail_sample', db.engine, if_exists='replace', index=False)
