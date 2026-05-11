from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# ── Register ViewSet routes ─────────────────────────────────────────────────
router = DefaultRouter()
router.register(r'employees', views.EmployeeViewSet, basename='employee')
router.register(r'departments', views.DepartmentViewSet, basename='department')

urlpatterns = [
    # ── Authentication routes ────────────────────────────────────────────────
    path('login/',   views.login_view,   name='employee-login'),
    path('refresh/', views.refresh_view, name='employee-refresh'),
    path('logout/',  views.logout_view,  name='employee-logout'),
    path('me/',      views.me_view,      name='employee-me'),
    
    # ── Employee management routes (via router) ─────────────────────────────
    path('', include(router.urls)),
]