import argparse
from uuid import UUID
from .config import settings
from .db import Store


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('init-db')
    grant = sub.add_parser('grant')
    grant.add_argument('user_id', type=UUID)
    grant.add_argument('seconds', type=int)
    args = parser.parse_args()
    store = Store(settings().database_url)
    if args.command == 'init-db':
        store.initialize()
        for user_id in settings().admin_user_ids.split(','):
            if user_id.strip(): store.ensure_member(str(UUID(user_id.strip())),bootstrap=True)
    elif args.command == 'grant': store.grant(str(args.user_id), args.seconds)


if __name__ == '__main__': main()
