/* eslint-disable */
document.addEventListener("DOMContentLoaded", function () {

  // --- Biểu đồ doanh thu theo tháng ---
  const monthlyCtx = document.getElementById("monthlyChart")?.getContext("2d");
  let monthlyData = [];
  const revenueDataElement = document.getElementById("dashboardRevenueData");
  if (revenueDataElement) {
    try {
      monthlyData = JSON.parse(revenueDataElement.textContent);
      console.log("Monthly Revenue Data:", monthlyData);
    } catch (error) {
      console.error("Error parsing monthly revenue data:", error);
    }
  } else {
    console.error("Không tìm thấy phần tử chứa monthly revenue data!");
  }

  let monthlyChartInstance;
  function createMonthlyChart() {
    if (monthlyChartInstance) monthlyChartInstance.destroy();
    monthlyChartInstance = new Chart(monthlyCtx, {
      type: "bar",
      data: {
        labels: monthlyData.map(item => item.month),
        datasets: [{
          label: "Doanh thu (VND)",
          data: monthlyData.map(item => item.revenue),
          backgroundColor: "rgba(54, 162, 235, 0.5)",
          borderColor: "rgba(54, 162, 235, 1)",
          borderWidth: 1,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function (value) {
                return value >= 1000000 ? (value/1000000).toFixed(1) + " triệu" : value;
              }
            }
          }
        },
        plugins: {
          title: { display: true, text: "Doanh thu theo tháng (VND)" },
          legend: { position: "bottom" }
        }
      }
    });
    console.log("Monthly chart created!");
  }
  createMonthlyChart();

  // --- Biểu đồ doanh thu theo ngày ---
  const dailyCtx = document.getElementById("dailyChart")?.getContext("2d");
  let dailyRevenueByMonth = [];
  const dailyRevenueDataElement = document.getElementById("dashboardDailyRevenueData");
  if (dailyRevenueDataElement) {
    try {
      dailyRevenueByMonth = JSON.parse(dailyRevenueDataElement.textContent);
      console.log("Daily Revenue Data:", dailyRevenueByMonth);
    } catch (error) {
      console.error("Error parsing daily revenue data:", error);
    }
  } else {
    console.error("Không tìm thấy phần tử chứa daily revenue data!");
  }

  let dailyChartInstance;
  function createDailyChart(monthIndex) {
    if (dailyChartInstance) dailyChartInstance.destroy();
    const monthData = dailyRevenueByMonth[monthIndex];
    if (!monthData) {
      console.error("Không có dữ liệu cho tháng được chọn!");
      return;
    }
    dailyChartInstance = new Chart(dailyCtx, {
      type: "line",
      data: {
        labels: monthData.days.map(day => day.day),
        datasets: [{
          label: `Doanh thu ${monthData.month} (VND)`,
          data: monthData.days.map(day => day.revenue),
          backgroundColor: "rgba(255, 99, 132, 0.5)",
          borderColor: "rgba(255, 99, 132, 1)",
          borderWidth: 1,
          fill: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function (value) {
                return value >= 1000000 ? (value/1000000).toFixed(1) + " triệu" : value;
              }
            }
          }
        },
        plugins: {
          title: { display: true, text: `Doanh thu theo ngày - ${monthData.month} (VND)` },
          legend: { position: "bottom" }
        }
      }
    });
    console.log("Daily chart created for month:", monthData.month);
  }

  // Lấy tháng hiện tại (0-11)
  const currentMonth = new Date().getMonth();
  // Khởi tạo biểu đồ doanh thu theo ngày cho tháng hiện tại thay vì mặc định là tháng đầu tiên
  createDailyChart(currentMonth);

  // Lắng nghe sự thay đổi của dropdown chọn tháng và tự động chọn tháng hiện tại khi trang tải
  const selectMonthElement = document.getElementById("selectMonth");
  if (selectMonthElement) {
    // Tự động chọn option tương ứng với tháng hiện tại
    selectMonthElement.value = currentMonth;
    selectMonthElement.addEventListener("change", function () {
      const monthIndex = parseInt(this.value);
      createDailyChart(monthIndex);
    });
  }

  // Lắng nghe sự thay đổi của dropdown chọn năm
  // Khi năm thay đổi, reload trang với query parameter 'year'
  const selectYearElement = document.getElementById("selectYear");
  if (selectYearElement) {
    selectYearElement.addEventListener("change", function () {
      const chosenYear = this.value;
      window.location.href = `/dashboard?year=${chosenYear}`;
    });
  }
});
