<template>
    <div id="app" class="container-fluid">
        <div class="site-info">
            <h1>Leadminer</h1>
            <h3>First Demo</h3>
        </div>
        <nav>
            <router-link class="btn btn-primary" to="/">Get Emails</router-link>
        </nav>
        <br/>
        <router-view/>
    </div>
</template>

<script>
export default {
  name: "app"
};
</script>

<style>
.site-info {
  color: blue;
  margin-bottom: 20px;
}

.btn-primary {
  margin-right: 5px;
}

.container-fluid {
  text-align: center;
}
</style>
