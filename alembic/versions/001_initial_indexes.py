from sqlalchemy import MetaData, Table, Column, String, Float, DateTime, Index, Boolean, Text

meta = MetaData()

IndexDef = Table(
    'IndexDef', meta,
    Column('id', String, primary_key=True),
    Column('code', String, unique=True, nullable=False),
    Column('name', String, nullable=False),
    Column('webId', String, unique=True, nullable=False),
    Column('category', String, nullable=False),
    Column('fetchedAt', DateTime),
    Column('candleCount', Float),
    Column('status', String, default='pending'),
    Column('errorMsg', Text),
    Column('createdAt', DateTime),
    Column('updatedAt', DateTime),
    Index('idx_indexdef_code', 'code'),
    Index('idx_indexdef_status', 'status'),
)

IndexHistory = Table(
    'IndexHistory', meta,
    Column('id', String, primary_key=True),
    Column('indexDefId', String, nullable=False),
    Column('date', String, nullable=False),
    Column('jDate', String),
    Column('open', Float),
    Column('high', Float),
    Column('low', Float),
    Column('close', Float),
    Column('volume', Float, default=0),
    Index('idx_indexhistory_def', 'indexDefId'),
    Index('idx_indexhistory_date', 'date'),
)
