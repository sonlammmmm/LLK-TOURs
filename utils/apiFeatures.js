class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  //N1
  // 1. Tìm theo bộ lọc
  filter() {
    const queryObj = { ...this.queryString };
    const excludedFields = ['page', 'sort', 'limit', 'fields'];
    excludedFields.forEach(el => delete queryObj[el]);

    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`); //N2

    this.query.find(JSON.parse(queryStr));

    return this;
  }

  //N3
  // 2. Sắp xếp
  sort() {
    if (this.queryString.sort) {
      //N4
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort('-createdAt'); //N5
    }

    return this;
  }

  //N6
  // 3. Giới hạn trường
  limitFields() {
    if (this.queryString.fields) {
      //N7
      const fields = this.queryString.fields.split(',').join('    ');
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select('-__v'); //N8
    }

    return this;
  }

  //N9
  // 4. Phân trang
  paginate() {
    const page = this.queryString.page * 1 || 1; //N10
    const limit = this.queryString.limit * 1 || 100; //Số lượng phần tử dữ liệu 1 trang
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);

    return this;
  }
}

module.exports = APIFeatures;
