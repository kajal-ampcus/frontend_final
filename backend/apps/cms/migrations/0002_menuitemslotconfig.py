import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cms', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='MenuItemSlotConfig',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('slot_id', models.CharField(max_length=100)),
                ('slot_name', models.CharField(blank=True, default='', max_length=100)),
                ('slot_start_time', models.TimeField(blank=True, null=True)),
                ('slot_end_time', models.TimeField(blank=True, null=True)),
                ('quantity_per_slot', models.PositiveIntegerField()),
                ('max_qty_per_order', models.PositiveIntegerField(default=1)),
                ('max_qty_per_person', models.PositiveIntegerField(default=1)),
                ('max_qty_per_day', models.PositiveIntegerField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('canteen', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='menu_item_slot_configs', to='cms.canteenlocation')),
                ('menu_item', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='slot_configs', to='cms.menuorderitem')),
            ],
            options={
                'db_table': 'cms_menu_item_slot_configs',
                'ordering': ['slot_name', 'slot_id'],
                'unique_together': {('menu_item', 'slot_id')},
            },
        ),
        migrations.AddIndex(
            model_name='menuitemslotconfig',
            index=models.Index(fields=['menu_item_id', 'is_active'], name='idx_misc_item_active'),
        ),
        migrations.AddIndex(
            model_name='menuitemslotconfig',
            index=models.Index(fields=['canteen_id', 'slot_id', 'is_active'], name='idx_misc_canteen_slot_active'),
        ),
    ]
