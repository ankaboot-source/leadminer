<template>


  <div class="columns">
                <h4>Emails List : {{customers.length}} emails fetched (inc duplicates)</h4>

    <div class="table-scroll">
      <table >
        <thead>
          <tr>
            <th width="100">From</th>
            <th width="100">To</th>
            <th>Subject</th>
            <th>date</th>
          </tr>
        </thead>
        <tbody  v-for="(customer, index) in customers" :key="index">
          <tr >
            <td>{{customer.from}}</td>
            <td>{{customer.to}}</td>
            <td>{{customer.subject}}</td>
            <td>{{customer.date}}</td>
            

          </tr>
          
        </tbody>
        
      </table>
    </div>
</div>

</template>

<script>
import http from "../http-common";

export default {
  name: "customers-list",
  data() {
    return {
      customers: []
    };
  },
  methods: {
    /* eslint-disable no-console */
    retrieveCustomers() {
      http
        .get("/emails")
        .then(response => {
          this.customers = response.data.data; // JSON are parsed automatically.
          console.log(response.data.data);
        })
        .catch(e => {
          console.log(e);
        });
    },
    refreshList() {
      this.retrieveCustomers();
    }
    /* eslint-enable no-console */
  },
  mounted() {
    this.retrieveCustomers();
  }
};
</script>

<style>
.list {
  text-align: left;
  max-width: 450px;
  margin: auto;
}
</style>
