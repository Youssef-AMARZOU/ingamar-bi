import kagglehub
import pandas as pd
import psycopg2
import os

print("Downloading dataset from Kaggle...")
path = kagglehub.dataset_download("abdulmaliklodhra/social-media-addiction-and-mental-health-dataset")
print(f"Dataset downloaded to: {path}")

import glob
csv_files = glob.glob(os.path.join(path, "*.csv"))
print(f"Found CSV files: {csv_files}")

if not csv_files:
    print("No CSV files found!")
    exit(1)

csv_file = csv_files[0]
print(f"Loading: {csv_file}")
df = pd.read_csv(csv_file)

print(f"Dataset shape: {df.shape}")
print(f"Columns: {list(df.columns)}")
print(df.head())

print("\nConnecting to PostgreSQL...")
conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="ingamar",
    user="ingamar",
    password="ingamar"
)
cursor = conn.cursor()

table_name = "social_media_mental_health"

print(f"\nCreating table: {table_name}")

columns = []
for col in df.columns:
    clean_col = col.replace(' ', '_').replace('-', '_').lower()
    dtype = str(df[col].dtype)
    if 'int' in dtype:
        sql_type = 'INTEGER'
    elif 'float' in dtype:
        sql_type = 'DOUBLE PRECISION'
    elif 'bool' in dtype:
        sql_type = 'BOOLEAN'
    else:
        sql_type = 'TEXT'
    columns.append(f'"{clean_col}" {sql_type}')

create_sql = f"DROP TABLE IF EXISTS {table_name}; CREATE TABLE {table_name} ({', '.join(columns)});"
cursor.execute(create_sql)
conn.commit()
print("Table created!")

print("Inserting data...")
clean_columns = [col.replace(' ', '_').replace('-', '_').lower() for col in df.columns]
placeholders = ', '.join(['%s'] * len(df.columns))
insert_sql = f"INSERT INTO {table_name} ({', '.join(['\"' + c + '\"' for c in clean_columns])}) VALUES ({placeholders})"

batch_size = 500
for i in range(0, len(df), batch_size):
    batch = df.iloc[i:i+batch_size]
    values = []
    for _, row in batch.iterrows():
        row_values = []
        for val in row:
            if pd.isna(val):
                row_values.append(None)
            elif isinstance(val, (bool,)):
                row_values.append(val)
            else:
                row_values.append(str(val))
        values.append(tuple(row_values))
    
    cursor.executemany(insert_sql, values)
    conn.commit()
    print(f"Inserted rows {i} to {i+len(batch)}")

print(f"\nTotal rows inserted: {len(df)}")

cursor.execute(f"SELECT COUNT(*) FROM {table_name};")
count = cursor.fetchone()[0]
print(f"Verified count: {count}")

cursor.close()
conn.close()
print("\nDone! Dataset imported successfully.")
