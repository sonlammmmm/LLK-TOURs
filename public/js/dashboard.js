/* eslint-disable */
document.addEventListener('DOMContentLoaded', function () {
  const monthlyCtx = document.getElementById('monthlyChart')?.getContext('2d');
  let monthlyData = [];
  const revenueDataElement = document.getElementById('dashboardRevenueData');
  if (revenueDataElement) {
    try {
      monthlyData = JSON.parse(revenueDataElement.textContent);
    } catch (error) {
      console.error('Lỗi parse dữ liệu doanh thu tháng:', error);
    }
  }

  let monthlyChartInstance;
  function createMonthlyChart() {
    if (!monthlyCtx || !monthlyData.length) return;
    if (monthlyChartInstance) monthlyChartInstance.destroy();
    monthlyChartInstance = new Chart(monthlyCtx, {
      type: 'bar',
      data: {
        labels: monthlyData.map(item => item.month),
        datasets: [
          {
            label: 'Doanh thu (VND)',
            data: monthlyData.map(item => item.revenue),
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function (value) {
                return value >= 1000000
                  ? `${(value / 1000000).toFixed(1)} triệu`
                  : value;
              }
            }
          }
        },
        plugins: {
          title: { display: true, text: 'Doanh thu theo tháng (VND)' },
          legend: { position: 'bottom' }
        }
      }
    });
  }
  createMonthlyChart();

  const dailyCtx = document.getElementById('dailyChart')?.getContext('2d');
  let dailyRevenueByMonth = [];
  const dailyRevenueDataElement = document.getElementById('dashboardDailyRevenueData');
  if (dailyRevenueDataElement) {
    try {
      dailyRevenueByMonth = JSON.parse(dailyRevenueDataElement.textContent);
    } catch (error) {
      console.error('Lỗi parse dữ liệu doanh thu ngày:', error);
    }
  }

  let dailyChartInstance;
  function createDailyChart(monthIndex) {
    if (!dailyCtx || !dailyRevenueByMonth.length) return;
    if (dailyChartInstance) dailyChartInstance.destroy();
    const monthData = dailyRevenueByMonth[monthIndex];
    if (!monthData) return;
    dailyChartInstance = new Chart(dailyCtx, {
      type: 'line',
      data: {
        labels: monthData.days.map(day => day.day),
        datasets: [
          {
            label: `Doanh thu ${monthData.month} (VND)`,
            data: monthData.days.map(day => day.revenue),
            backgroundColor: 'rgba(255, 99, 132, 0.5)',
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 1,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function (value) {
                return value >= 1000000
                  ? `${(value / 1000000).toFixed(1)} triệu`
                  : value;
              }
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: `Doanh thu theo ngày - ${monthData.month} (VND)`
          },
          legend: { position: 'bottom' }
        }
      }
    });
  }

  const selectMonthElement = document.getElementById('selectMonth');
  const defaultMonth = selectMonthElement
    ? parseInt(selectMonthElement.value, 10)
    : new Date().getMonth();
  createDailyChart(defaultMonth);
  if (selectMonthElement) {
    selectMonthElement.value = defaultMonth;
    selectMonthElement.addEventListener('change', function () {
      const monthIndex = parseInt(this.value, 10);
      if (!Number.isNaN(monthIndex)) {
        createDailyChart(monthIndex);
      }
    });
  }

  const statusCtx = document.getElementById('statusChart')?.getContext('2d');
  let statusData = [];
  const statusDataElement = document.getElementById('dashboardStatusData');
  if (statusDataElement) {
    try {
      statusData = JSON.parse(statusDataElement.textContent);
    } catch (error) {
      console.error('Lỗi parse dữ liệu trạng thái đơn:', error);
    }
  }

  let statusChartInstance;
  function createStatusChart() {
    if (!statusCtx || !statusData.length) return;
    if (statusChartInstance) statusChartInstance.destroy();
    statusChartInstance = new Chart(statusCtx, {
      type: 'doughnut',
      data: {
        labels: statusData.map(item => item.label),
        datasets: [
          {
            data: statusData.map(item => item.value),
            backgroundColor: ['#22c55e', '#f97316'],
            borderColor: ['#15803d', '#c2410c'],
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          title: { display: true, text: 'Tỷ lệ đơn hàng theo trạng thái' }
        }
      }
    });
  }
  createStatusChart();

  const entityCtx = document.getElementById('entityChart')?.getContext('2d');
  let entityData = [];
  const entityDataElement = document.getElementById('dashboardEntityData');
  if (entityDataElement) {
    try {
      entityData = JSON.parse(entityDataElement.textContent);
    } catch (error) {
      console.error('Lỗi parse dữ liệu tài nguyên:', error);
    }
  }

  let entityChartInstance;
  function createEntityChart() {
    if (!entityCtx || !entityData.length) return;
    if (entityChartInstance) entityChartInstance.destroy();
    entityChartInstance = new Chart(entityCtx, {
      type: 'bar',
      data: {
        labels: entityData.map(item => item.label),
        datasets: [
          {
            label: 'Tổng số',
            data: entityData.map(item => item.value),
            backgroundColor: 'rgba(147, 197, 253, 0.7)',
            borderColor: 'rgba(59, 130, 246, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true
          }
        },
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'So sánh số lượng tài nguyên' }
        }
      }
    });
  }
  createEntityChart();

  const selectYearElement = document.getElementById('selectYear');
  if (selectYearElement) {
    selectYearElement.addEventListener('change', function () {
      const chosenYear = this.value;
      window.location.href = `/admin/dashboard?year=${chosenYear}`;
    });
  }
});
